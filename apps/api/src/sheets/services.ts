import { env } from 'cloudflare:workers';
import { Array, Console, Context, Data, Effect, Layer, pipe } from 'effect';
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { TransactionRequestType } from './schemas';

export class Client extends Context.Service<
	Client,
	{
		readonly query: () => Effect.Effect<string, QueryError>;
		readonly transaction: {
			append: (payload: TransactionRequestType) => Effect.Effect<void, QueryError>;
		};
	}
>()('SheetsClient') {}

export class InitializationError extends Data.TaggedError('InitializationError')<{
	readonly cause: unknown;
}> {}

export class QueryError extends Data.TaggedError('QueryError')<{
	readonly cause: unknown;
}> {}

export const ClientLive = Layer.effect(
	Client,
	Effect.tryPromise({
		try: async () => {
			const auth = new JWT({
				email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
				key: env.GOOGLE_PRIVATE_KEY,
				scopes: ['https://www.googleapis.com/auth/spreadsheets'],
				transporterOptions: {
					fetchImplementation: fetch,
				},
			});

			const doc = new GoogleSpreadsheet(env.GOOGLE_SHEET_ID, auth);

			await doc.loadInfo();

			const query = () =>
				pipe(
					doc.sheetsByIndex,
					Array.head,
					Effect.fromOption,
					Effect.mapError(({ cause }) => new QueryError({ cause })),
					Effect.map((e) => e.title),
				);

			const transactionAppend = () =>
				pipe(
					doc.sheetsByIndex,
					Array.head,
					Effect.fromOption,
					Effect.flatMap(Console.log),
					Effect.mapError(({ cause }) => new QueryError({ cause })),
				);

			return {
				query: query,
				transaction: {
					append: transactionAppend,
				},
			};
		},
		catch: (cause: unknown) => new InitializationError({ cause }),
	}),
);
