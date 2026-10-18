import { env } from 'cloudflare:workers';
import { Array, Console, Context, Effect, Layer, Number, Option, pipe, Record, Schema } from 'effect';
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { TransactionCreate, TransactionRead, TransactionSheet, TransactionSheetType, TransactionUpdate } from './schema';

export class InitializationError extends Schema.TaggedError<InitializationError>()(
	'InitializationError',
	{
		message: Schema.String,
		cause: Schema.optional(Schema.Defect()),
	},
	{ httpApiStatus: 503 },
) {}

export class QueryError extends Schema.TaggedError<QueryError>()(
	'QueryError',
	{
		message: Schema.String,
		cause: Schema.optional(Schema.Defect()),
	},
	{ httpApiStatus: 500 },
) {}

export class TransactionNotFoundError extends Schema.TaggedError<TransactionNotFoundError>()(
	'TransactionNotFoundError',
	{
		no: Schema.Number,
		message: Schema.String,
	},
	{ httpApiStatus: 404 },
) {}

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
			append: (payload: typeof TransactionCreate.Type) => Effect.Effect<void, SheetsError>;
			get: () => Effect.Effect<(typeof TransactionRead.Type)[], SheetsError>;
			update: (payload: typeof TransactionUpdate.Type) => Effect.Effect<void, SheetsError | TransactionNotFoundError>;
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
	catch: (cause: unknown) =>
		new InitializationError({
			message: 'Failed to initialize Google Spreadsheet document',
			cause,
		}),
}).pipe(
	Effect.withLogSpan('SheetsClient.loadDocument'),
	Effect.tapError((err) => Effect.logError(err.message, err)),
);

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
					Effect.mapError(() => new QueryError({ message: `Sheet "${Sheets.Transaction}" not found` })),
				);

				yield* Effect.tryPromise({
					try: () => sheet.loadHeaderRow(3),
					catch: (cause: unknown) =>
						new QueryError({
							message: `Failed to load header row for sheet "${Sheets.Transaction}"`,
							cause,
						}),
				});

				return sheet;
			}).pipe(Effect.withLogSpan('SheetsClient.getTransactionSheet')),
			'30 minutes',
		);

		const decodeTransactionRow = Schema.decodeUnknownEffect(TransactionSheet);
		const encodeTransactionRow = Schema.encodeEffect(TransactionSheet);

		const transactionAppend = Effect.fn('SheetsClient.transaction.append')(
			function* (request: typeof TransactionCreate.Type) {
				const transactionSheet = yield* getTransactionSheet;

				const latestNo = yield* Effect.tryPromise({
					try: () => transactionSheet.getRows<TransactionSheetType>(),
					catch: (cause: unknown) =>
						new QueryError({
							message: 'Failed to fetch rows to determine latest transaction number',
							cause,
						}),
				}).pipe(Effect.map((rows) => rows.reduce((max, row) => Math.max(max, Number.Number(row.get('No')) || 0), 0)));

				const remainingBalance = Option.orElse(request.remainingBalance, () =>
					Option.map(request.downPayment, (dp) => request.sellingPrice - dp),
				);

				const payload = {
					...request,
					no: latestNo + 1,
					remainingBalance,
				};

				const payloadJson = yield* encodeTransactionRow(payload).pipe(
					Effect.mapError(
						(cause) =>
							new QueryError({
								message: 'Failed to encode transaction row for append',
								cause,
							}),
					),
				);

				yield* Effect.tryPromise({
					try: () => transactionSheet.addRow(payloadJson as Record<string, any>),
					catch: (cause) =>
						new QueryError({
							message: 'Failed to append row to transaction sheet',
							cause,
						}),
				});
			},
			Effect.tapError((err) => Effect.logError(err.message, err)),
		);

		const transactionsGet = Effect.fn('SheetsClient.transaction.get')(
			function* () {
				const transactionSheet = yield* getTransactionSheet;

				const rows = yield* Effect.tryPromise({
					try: () => transactionSheet.getRows<TransactionSheetType>(),
					catch: (cause: unknown) =>
						new QueryError({
							message: 'Failed to fetch transaction rows',
							cause,
						}),
				});

				const decodedRows = yield* Effect.forEach(rows, (row) =>
					decodeTransactionRow(row.toObject()).pipe(
						Effect.mapError(
							(cause) =>
								new QueryError({
									message: `Failed to decode transaction row ${row.rowNumber}`,
									cause,
								}),
						),
					),
				);

				return decodedRows;
			},
			Effect.tapError((err) => Effect.logError(err.message, err)),
		);

		const transactionUpdate = Effect.fn('SheetsClient.transaction.update')(
			function* (request: typeof TransactionUpdate.Type) {
				const transactionSheet = yield* getTransactionSheet;

				const target = yield* Effect.tryPromise({
					try: () => transactionSheet.getRows<TransactionSheetType>(),
					catch: (cause: unknown) =>
						new QueryError({
							message: `Failed to fetch rows to update transaction #${request.no}`,
							cause,
						}),
				}).pipe(
					Effect.map(
						Array.findFirst((z) =>
							pipe(
								z.get('No'),
								Number.parse,
								Option.exists((no) => no === request.no),
							),
						),
					),
					Effect.flatMap(
						Option.match({
							onNone: () =>
								Effect.fail(
									new TransactionNotFoundError({
										no: request.no,
										message: `Transaction #${request.no} not found`,
									}),
								),
							onSome: Effect.succeed,
						}),
					),
					Effect.tap(Console.log),
				);
			},
			Effect.tapError((err) => Effect.logError(err.message, err)),
		);

		return {
			transaction: {
				append: transactionAppend,
				get: transactionsGet,
				update: transactionUpdate,
			},
		};
	}),
);
