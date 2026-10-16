import { HttpServerRequest, HttpServerResponse } from 'effect/http';
import { TransactionRequest, type TransactionRequestType } from './schemas';
import { Effect } from 'effect';
import { Client } from './services';

export const queryFirstSheet = Client.pipe(
	Effect.flatMap((c) => c.query()),
	Effect.flatMap((s) => HttpServerResponse.json({ firstSheet: s })),
	Effect.orElseSucceed(() => HttpServerResponse.jsonUnsafe({ error: 'Query failed' }, { status: 500 })),
);

export const appendTransaction = HttpServerRequest.schemaBodyJson(TransactionRequest).pipe(
	Effect.flatMap((p) => Client.pipe(Effect.flatMap((c) => c.transaction.append(p)))),
	Effect.orElseSucceed(() => HttpServerResponse.jsonUnsafe({ error: 'Append failed' }, { status: 500 })),
);
