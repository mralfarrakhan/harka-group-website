import { HttpServerRequest, HttpServerResponse } from 'effect/http';
import { TransactionRequest } from './schemas';
import { Effect } from 'effect';
import { Client } from './services';

export const appendTransaction = HttpServerRequest.schemaBodyJson(TransactionRequest).pipe(
	Effect.flatMap((p) => Client.pipe(Effect.flatMap((c) => c.transaction.append(p)))),
	Effect.orElseSucceed(({ cause, message }) => HttpServerResponse.jsonUnsafe({ error: 'Append failed', cause, message }, { status: 500 })),
);
