import { Effect, Layer, Schema } from 'effect';
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from 'effect/http-api';
import {
	Client,
	InitializationError,
	QueryError,
	TransactionCreate,
	TransactionNotFoundError,
	TransactionRead,
	TransactionUpdate,
} from './sheets';

const Transactions = HttpApiGroup.make('transactions')
	.add(
		HttpApiEndpoint.post('append', '/append', {
			payload: TransactionCreate,
			error: [InitializationError, QueryError],
		}),
	)
	.add(
		HttpApiEndpoint.get('get', '/', {
			success: Schema.Array(TransactionRead),
			error: [InitializationError, QueryError],
		}),
	)
	.add(
		HttpApiEndpoint.patch('update', '/update', {
			payload: TransactionUpdate,
			error: [InitializationError, QueryError, TransactionNotFoundError],
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
			.handle('append', ({ payload }) => client.transaction.append(payload))
			.handle('get', () => client.transaction.get())
			.handle('update', ({ payload }) => client.transaction.update(payload));
	}),
);

export const ApiLive = HttpApiBuilder.layer(Api, {
	openapiPath: '/openapi.json',
}).pipe(Layer.provide([TransactionLive]));
