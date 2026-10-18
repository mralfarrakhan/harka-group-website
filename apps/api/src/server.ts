import { Effect, Layer, Schema } from 'effect';
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from 'effect/http-api';
import {
	Client,
	InitializationError,
	QueryError,
	Transaction,
	TransactionCreate,
	TransactionDelete,
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
			query: TransactionRead,
			success: Schema.Array(Transaction),
			error: [InitializationError, QueryError, TransactionNotFoundError],
		}),
	)
	.add(
		HttpApiEndpoint.patch('update', '/update', {
			payload: TransactionUpdate,
			error: [InitializationError, QueryError, TransactionNotFoundError],
		}),
	)
	.add(
		HttpApiEndpoint.delete('delete', '/delete', {
			payload: TransactionDelete,
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
			.handle('get', ({ query }) => client.transaction.get(query))
			.handle('update', ({ payload }) => client.transaction.update(payload))
			.handle('delete', ({ payload }) => client.transaction.delete(payload));
	}),
);

export const ApiLive = HttpApiBuilder.layer(Api, {
	openapiPath: '/openapi.json',
}).pipe(Layer.provide([TransactionLive]));
