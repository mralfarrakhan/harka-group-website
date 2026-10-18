import { Effect, Layer, Schema } from 'effect';
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/http-api';
import { Client, TransactionCreate, TransactionRead, TransactionUpdate } from './sheets';

const Transactions = HttpApiGroup.make('transactions')
	.add(
		HttpApiEndpoint.post('append', '/append', {
			payload: TransactionCreate,
			error: HttpApiError.InternalServerError,
		}),
	)
	.add(
		HttpApiEndpoint.get('get', '/', {
			success: Schema.Array(TransactionRead),
			error: HttpApiError.InternalServerError,
		}),
	)
	.add(
		HttpApiEndpoint.patch('update', '/update', {
			payload: TransactionUpdate,
			error: HttpApiError.InternalServerError,
		}),
	)
	.prefix('/sheets/transactions');

class Api extends HttpApi.make('Api').add(Transactions) {}

const TransactionLive = HttpApiBuilder.group(
	Api,
	'transactions',
	Effect.fn(function* (handlers) {
		const client = yield* Client;

		return handlers
			.handle('append', ({ payload }) =>
				client.transaction.append(payload).pipe(Effect.mapError(() => new HttpApiError.InternalServerError())),
			)
			.handle('get', () => client.transaction.get().pipe(Effect.mapError(() => new HttpApiError.InternalServerError())))
			.handle('update', ({ payload }) =>
				client.transaction.update(payload).pipe(Effect.mapError(() => new HttpApiError.InternalServerError())),
			);
	}),
);

export const ApiLive = HttpApiBuilder.layer(Api, {
	openapiPath: '/openapi.json',
}).pipe(Layer.provide([TransactionLive]));
