import { env } from 'cloudflare:workers';
import { Array, Console, Context, Data, Effect, Layer, Number, Option, Order, pipe, Record, Schema } from 'effect';
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { TransactionRequestType, TransactionSheet, TransactionSheetType, TransactionType } from './schemas';

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
		readonly transaction: {
			append: (payload: TransactionRequestType) => Effect.Effect<void, SheetsError>;
			get: () => Effect.Effect<TransactionType[], SheetsError>;
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
		const [getDocument] = yield* Effect.cachedInvalidateWithTTL(loadDocument, '10 minutes');

		const [getTransactionSheet] = yield* Effect.cachedInvalidateWithTTL(
			Effect.gen(function* () {
				const doc = yield* getDocument;

				const sheet = yield* pipe(
					doc.sheetsByTitle,
					Record.get(Sheets.Transaction),
					Effect.fromOption,
					Effect.mapError(({ cause }) => new QueryError({ cause })),
				);

				yield* Effect.tryPromise({
					try: () => sheet.loadHeaderRow(3),
					catch: (cause: unknown) => new QueryError({ cause }),
				});

				return sheet;
			}),
			'30 minutes',
		);

		const decodeTransactionRow = Schema.decodeUnknownEffect(TransactionSheet);
		const encodeTransactionRow = Schema.encodeEffect(TransactionSheet);

		const transactionAppend = (request: TransactionRequestType) =>
			Effect.gen(function* () {
				const transactionSheet = yield* getTransactionSheet;

				const latestNo = yield* Effect.tryPromise({
					try: () => transactionSheet.getRows<TransactionSheetType>(),
					catch: (cause: unknown) => new QueryError({ cause }),
				}).pipe(Effect.map((rows) => rows.reduce((max, row) => Math.max(max, Number.Number(row.get('No')) || 0), 0)));

				const remainingBalance = Option.orElse(request.remainingBalance, () =>
					Option.map(request.downPayment, (dp) => request.sellingPrice - dp),
				);

				const payload = {
					...request,
					no: latestNo + 1,
					remainingBalance,
				};

				const payloadJson = yield* encodeTransactionRow(payload).pipe(Effect.mapError(({ cause }) => new QueryError({ cause })));

				yield* Effect.tryPromise({
					try: () => transactionSheet.addRow(payloadJson as Record<string, any>),
					catch: (cause) => new QueryError({ cause }),
				});
			});

		const transactionsGet = () =>
			Effect.gen(function* () {
				const transactionSheet = yield* getTransactionSheet;

				const rows = yield* Effect.tryPromise({
					try: () => transactionSheet.getRows<TransactionSheetType>(),
					catch: (cause: unknown) => new QueryError({ cause }),
				});

				const decodedRows = yield* Effect.forEach(rows, (row) => decodeTransactionRow(row.toObject())).pipe(
					Effect.mapError(({ cause }) => new QueryError({ cause })),
				);

				return decodedRows;
			});

		return {
			transaction: {
				append: transactionAppend,
				get: transactionsGet,
			},
		};
	}),
);
