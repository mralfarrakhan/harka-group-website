import { Layer } from 'effect';
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/http-api';
import { appendTransaction } from './sheets/handlers';

const Transactions = HttpApiGroup.make('transactions')
	.add(HttpApiEndpoint.post('append', '/append', { error: HttpApiError.InternalServerError }))
	.prefix('/sheets/transactions');

class Api extends HttpApi.make('Api').add(Transactions) {}

const TransactionLive = HttpApiBuilder.group(Api, 'transactions', (handlers) => handlers.handle('append', () => appendTransaction));

export const ApiLive = HttpApiBuilder.layer(Api, {
	openapiPath: '/openapi.json',
}).pipe(Layer.provide([TransactionLive]));
