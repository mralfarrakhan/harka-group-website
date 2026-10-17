import { env } from 'cloudflare:workers';
import { Array, Console, Context, Data, Effect, Layer, Number, Option, Order, pipe, Record } from 'effect';
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet, GoogleSpreadsheetRow } from 'google-spreadsheet';
import { TransactionRequestType, TransactionType } from './schemas';

export class InitializationError extends Data.TaggedError('InitializationError')<{
	readonly cause: unknown;
}> {}

export class QueryError extends Data.TaggedError('QueryError')<{
	readonly cause: unknown;
}> {}

export type SheetsError = InitializationError | QueryError;

export enum Sheets {
	Transaction = 'TRANSAKSI',
	UnitExpenditure = 'PENGELUARAN PER UNIT',
	Stock = 'STOK MOBIL',
	Modal = 'MODAL DAN HARGA JUAL',
	Modal2 = 'Copy of MODAL DAN HARGA JUAL',
	Profit = 'LAPORAN KEUNTUNGAN',
	Inventory = 'Inventory Showroom',
	Expenditure = 'PENGELUARAN KAS',
}

export class Client extends Context.Service<
	Client,
	{
		readonly query: () => Effect.Effect<string, SheetsError>;
		readonly transaction: {
			append: (payload: TransactionRequestType) => Effect.Effect<void, SheetsError>;
		};
	}
>()('SheetsClient') {}

const loadDocument = Effect.tryPromise({
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

		return doc;
	},
	catch: (cause: unknown) => new InitializationError({ cause }),
});

export const ClientLive = Layer.effect(
	Client,
	Effect.gen(function* () {
		const [getDocument, _invalidateDocument] = yield* Effect.cachedInvalidateWithTTL(loadDocument, '10 minutes');

		const query = () =>
			Effect.gen(function* () {
				const doc = yield* getDocument;

				const res = yield* pipe(
					doc.sheetsByIndex,
					Array.head,
					Effect.fromOption,
					Effect.mapError(({ cause }) => new QueryError({ cause })),
					Effect.map((e) => e.title),
				);

				return res;
			});

		const transactionAppend = (request: TransactionRequestType) =>
			Effect.gen(function* () {
				const doc = yield* getDocument;

				const transactionSheet = yield* pipe(
					doc.sheetsByTitle,
					Record.get(Sheets.Transaction),
					Effect.fromOption,
					Effect.mapError(({ cause }) => new QueryError({ cause })),
				);

				const latestNo = yield* pipe(
					Effect.tryPromise({
						try: () => transactionSheet.getRows<TransactionType>(),
						catch: (cause) => new QueryError({ cause }),
					}),
					Effect.flatMap((rows) =>
						pipe(
							rows,
							Array.head,
							Option.map((first) =>
								Array.reduce(rows, first, Order.max(Order.mapInput(Number.Order, (row) => Number.Number(row.get('No'))))),
							),
							Option.map((r) => Number.Number(r.get('No'))),
							Effect.fromOption,
							Effect.mapError(({ cause }) => new QueryError({ cause })),
						),
					),
				);

				const sisa = pipe(
					request['DP/ Panjar'],
					Option.map((dp) => request['Harga Jual'] - dp),
				);

				const payload: TransactionType = {
					...request,
					No: latestNo + 1,
					sisa: sisa,
				};

				yield* Effect.tryPromise({
					try: () => transactionSheet.addRow(payload as Record<string, any>),
					catch: (cause) => new QueryError({ cause }),
				});
			});

		return {
			query: query,
			transaction: {
				append: transactionAppend,
			},
		};
	}),
);
