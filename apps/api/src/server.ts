import { Layer } from 'effect';
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/http-api';
import { appendTransaction, queryFirstSheet } from './sheets/handlers';

const Transactions = HttpApiGroup.make('transactions')
	.add(
		HttpApiEndpoint.get('query', '/query', {
			error: HttpApiError.InternalServerError,
		}),
		HttpApiEndpoint.post('append', '/append'),
	)
	.prefix('/sheets/transactions');

class Api extends HttpApi.make('Api').add(Transactions) {}

const TransactionLive = HttpApiBuilder.group(Api, 'transactions', (handlers) =>
	handlers.handle('query', () => queryFirstSheet).handle('append', () => appendTransaction),
);

export const ApiLive = HttpApiBuilder.layer(Api, {
	openapiPath: '/openapi.json',
}).pipe(Layer.provide([TransactionLive]));
