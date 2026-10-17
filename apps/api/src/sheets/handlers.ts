import { HttpServerRequest, HttpServerResponse } from 'effect/http';
import { Transaction } from './schemas';
import { Effect } from 'effect';
import { Client } from './services';

export const queryFirstSheet = Client.pipe(
	Effect.flatMap((c) => c.query()),
	Effect.flatMap((s) => HttpServerResponse.json({ firstSheet: s })),
	Effect.orElseSucceed(({ cause }) => HttpServerResponse.jsonUnsafe({ error: 'Query failed', cause }, { status: 500 })),
);

export const appendTransaction = HttpServerRequest.schemaBodyJson(Transaction).pipe(
	Effect.flatMap((p) => Client.pipe(Effect.flatMap((c) => c.transaction.append(p)))),
	Effect.orElseSucceed(({ cause }) => HttpServerResponse.jsonUnsafe({ error: 'Append failed', cause }, { status: 500 })),
);
