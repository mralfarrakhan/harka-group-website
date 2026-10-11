import { Context, Effect, Layer } from "effect";
import { JWT } from "google-auth-library";
import {
	GoogleSpreadsheet,
	type GoogleSpreadsheetRow,
	type GoogleSpreadsheetWorksheet,
} from "google-spreadsheet";
import {
	type CreateTransactionInput,
	type Transaction,
	type UpdateTransactionInput,
	formatCurrency,
	formatDateForSheet,
	mapRowToTransaction,
	mapTransactionToRowData,
	parseCurrency,
	parsePhone,
	SheetsApiError,
	TransactionNotFoundError,
	ValidationError,
} from "./schema";

export interface SheetsConfig {
	readonly email: string;
	readonly privateKey: string;
	readonly spreadsheetId: string;
}

export interface TransactionsService {
	readonly list: (filters?: {
		status?: string;
		search?: string;
	}) => Effect.Effect<Transaction[], SheetsApiError>;

	readonly getByNo: (
		no: number,
	) => Effect.Effect<Transaction, TransactionNotFoundError | SheetsApiError>;

	readonly create: (
		input: CreateTransactionInput,
	) => Effect.Effect<Transaction, SheetsApiError | ValidationError>;

	readonly update: (
		no: number,
		input: UpdateTransactionInput,
	) => Effect.Effect<Transaction, TransactionNotFoundError | SheetsApiError | ValidationError>;

	readonly delete: (no: number) => Effect.Effect<void, TransactionNotFoundError | SheetsApiError>;
}

export class TransactionsServiceTag extends Context.Tag("TransactionsService")<
	TransactionsServiceTag,
	TransactionsService
>() {
	static readonly make = (config: SheetsConfig) => makeTransactionsService(config);
	static readonly makeLayer = (config: SheetsConfig) =>
		Layer.sync(TransactionsServiceTag, () => makeTransactionsService(config));
}

export function makeTransactionsService(config: SheetsConfig): TransactionsService {
	const privateKey = config.privateKey.replace(/\\n/g, "\n");
	const auth = new JWT({
		email: config.email,
		key: privateKey,
		scopes: ["https://www.googleapis.com/auth/spreadsheets"],
	});

	const doc = new GoogleSpreadsheet(config.spreadsheetId, auth);

	let infoLoaded = false;
	let headersLoaded = false;

	/**
	 * Lazily loads document info and TRANSAKSI worksheet with Row 3 headers
	 */
	const getWorksheet = Effect.gen(function* () {
		if (!infoLoaded) {
			yield* Effect.tryPromise({
				try: () => doc.loadInfo(),
				catch: (cause) =>
					new SheetsApiError({
						message: "Failed to connect to Google Sheets and load document info",
						cause,
					}),
			});
			infoLoaded = true;
		}

		const sheet = doc.sheetsByTitle["TRANSAKSI"];

		if (!sheet) {
			return yield* new SheetsApiError({
				message: 'Sheet tab "TRANSAKSI" was not found in spreadsheet',
			});
		}

		// Hardcoded header row index: 3
		if (!headersLoaded) {
			yield* Effect.tryPromise({
				try: () => sheet.loadHeaderRow(3),
				catch: (cause) =>
					new SheetsApiError({
						message: 'Failed to load header row (row 3) from sheet "TRANSAKSI"',
						cause,
					}),
			});
			headersLoaded = true;
		}

		return sheet;
	});

	/**
	 * Helper to find all rows and locate a row by sequential "No"
	 */
	const findRowByNo = (sheet: GoogleSpreadsheetWorksheet, no: number) =>
		Effect.gen(function* () {
			const rows = yield* Effect.tryPromise({
				try: () => sheet.getRows(),
				catch: (cause) =>
					new SheetsApiError({
						message: "Failed to fetch rows from TRANSAKSI sheet",
						cause,
					}),
			});

			const targetNoStr = String(no);
			const row = rows.find((r) => {
				const rowNo = r.get("No");
				return rowNo === no || String(rowNo).trim() === targetNoStr;
			});

			if (!row) {
				return yield* new TransactionNotFoundError({
					no,
					message: `Transaction with No #${no} was not found`,
				});
			}

			return { row, allRows: rows };
		});

	return {
		list: (filters) =>
			Effect.gen(function* () {
				const sheet = yield* getWorksheet;
				const rows = yield* Effect.tryPromise({
					try: () => sheet.getRows(),
					catch: (cause) =>
						new SheetsApiError({
							message: "Failed to fetch transactions from Google Sheets",
							cause,
						}),
				});

				let transactions = rows
					.map(mapRowToTransaction)
					.filter((tx) => tx.no > 0 && Boolean(tx.deskripsiMobil || tx.namaPembeli));

				if (filters?.status) {
					const statusQuery = filters.status.toLowerCase().trim();
					transactions = transactions.filter((tx) =>
						tx.statusTransaksi.toLowerCase().includes(statusQuery),
					);
				}

				if (filters?.search) {
					const search = filters.search.toLowerCase().trim();
					transactions = transactions.filter(
						(tx) =>
							tx.platMobil.toLowerCase().includes(search) ||
							tx.namaPembeli.toLowerCase().includes(search) ||
							tx.deskripsiMobil.toLowerCase().includes(search) ||
							tx.salesMarketing.toLowerCase().includes(search) ||
							String(tx.no).includes(search),
					);
				}

				return transactions;
			}),

		getByNo: (no) =>
			Effect.gen(function* () {
				const sheet = yield* getWorksheet;
				const { row } = yield* findRowByNo(sheet, no);
				return mapRowToTransaction(row);
			}),

		create: (input) =>
			Effect.gen(function* () {
				if (!input.deskripsiMobil || !input.namaPembeli || !input.platMobil) {
					return yield* new ValidationError({
						message: "deskripsiMobil, namaPembeli, and platMobil are required",
					});
				}

				const sheet = yield* getWorksheet;
				const rows = yield* Effect.tryPromise({
					try: () => sheet.getRows(),
					catch: (cause) =>
						new SheetsApiError({
							message: "Failed to fetch rows to calculate next sequential No",
							cause,
						}),
				});

				// Calculate next sequential "No"
				let maxNo = 0;
				for (const r of rows) {
					const rawNo = r.get("No");
					const parsed = typeof rawNo === "number" ? rawNo : parseInt(String(rawNo || "0"), 10);
					if (!Number.isNaN(parsed) && parsed > maxNo) {
						maxNo = parsed;
					}
				}
				const nextNo = maxNo + 1;

				const hargaJual = Math.round(input.hargaJual);
				const dpPanjar = Math.round(input.dpPanjar ?? 0);
				const sisa =
					input.sisa !== undefined ? Math.round(input.sisa) : Math.max(0, hargaJual - dpPanjar);

				const statusTransaksi =
					input.statusTransaksi !== undefined
						? input.statusTransaksi
						: sisa <= 0
							? "LUNAS"
							: "BELUM LUNAS";

				const transaction: Transaction = {
					no: nextNo,
					tanggalTransaksi: input.tanggalTransaksi || new Date().toISOString().slice(0, 10),
					deskripsiMobil: input.deskripsiMobil.trim(),
					platMobil: input.platMobil.trim().toUpperCase(),
					kategoriTransaksi: input.kategoriTransaksi || "JUAL CASH LUNAS",
					namaPembeli: input.namaPembeli.trim().toUpperCase(),
					nomorTelpon: parsePhone(input.nomorTelpon),
					hargaJual,
					dpPanjar,
					sisa,
					salesMarketing: (input.salesMarketing || "").trim(),
					statusTransaksi,
					catatan: (input.catatan || "").trim(),
				};

				const rowData = mapTransactionToRowData(transaction);

				yield* Effect.tryPromise({
					try: () => sheet.addRow(rowData),
					catch: (cause) =>
						new SheetsApiError({
							message: `Failed to append transaction #${nextNo} to Google Sheets`,
							cause,
						}),
				});

				return transaction;
			}),

		update: (no, input) =>
			Effect.gen(function* () {
				const sheet = yield* getWorksheet;
				const { row } = yield* findRowByNo(sheet, no);

				const currentTx = mapRowToTransaction(row);

				const newHargaJual =
					input.hargaJual !== undefined ? Math.round(input.hargaJual) : currentTx.hargaJual;

				const newDpPanjar =
					input.dpPanjar !== undefined ? Math.round(input.dpPanjar) : currentTx.dpPanjar;

				const newSisa =
					input.sisa !== undefined
						? Math.round(input.sisa)
						: input.hargaJual !== undefined || input.dpPanjar !== undefined
							? Math.max(0, newHargaJual - newDpPanjar)
							: currentTx.sisa;

				const newStatus =
					input.statusTransaksi !== undefined
						? input.statusTransaksi
						: input.sisa !== undefined ||
							  input.hargaJual !== undefined ||
							  input.dpPanjar !== undefined
							? newSisa <= 0
								? "LUNAS"
								: "BELUM LUNAS"
							: currentTx.statusTransaksi;

				const updatedTx: Transaction = {
					no,
					tanggalTransaksi:
						input.tanggalTransaksi !== undefined
							? input.tanggalTransaksi
							: currentTx.tanggalTransaksi,
					deskripsiMobil:
						input.deskripsiMobil !== undefined
							? input.deskripsiMobil.trim()
							: currentTx.deskripsiMobil,
					platMobil:
						input.platMobil !== undefined
							? input.platMobil.trim().toUpperCase()
							: currentTx.platMobil,
					kategoriTransaksi:
						input.kategoriTransaksi !== undefined
							? input.kategoriTransaksi
							: currentTx.kategoriTransaksi,
					namaPembeli:
						input.namaPembeli !== undefined
							? input.namaPembeli.trim().toUpperCase()
							: currentTx.namaPembeli,
					nomorTelpon:
						input.nomorTelpon !== undefined ? parsePhone(input.nomorTelpon) : currentTx.nomorTelpon,
					hargaJual: newHargaJual,
					dpPanjar: newDpPanjar,
					sisa: newSisa,
					salesMarketing:
						input.salesMarketing !== undefined
							? input.salesMarketing.trim()
							: currentTx.salesMarketing,
					statusTransaksi: newStatus,
					catatan: input.catatan !== undefined ? input.catatan.trim() : currentTx.catatan,
				};

				const rowUpdates: Record<string, string | number> = {};
				if (input.tanggalTransaksi !== undefined) {
					rowUpdates["Tanggal Transaksi"] = formatDateForSheet(updatedTx.tanggalTransaksi);
				}
				if (input.deskripsiMobil !== undefined) {
					rowUpdates["Deskripsi Mobil"] = updatedTx.deskripsiMobil;
				}
				if (input.platMobil !== undefined) {
					rowUpdates["Plat mobil"] = updatedTx.platMobil;
				}
				if (input.kategoriTransaksi !== undefined) {
					rowUpdates["Kategori Transaksi"] = updatedTx.kategoriTransaksi;
				}
				if (input.namaPembeli !== undefined) {
					rowUpdates["Nama Pembeli"] = updatedTx.namaPembeli;
				}
				if (input.nomorTelpon !== undefined) {
					rowUpdates["Nomor Telpon"] = updatedTx.nomorTelpon;
				}
				if (input.hargaJual !== undefined) {
					rowUpdates["Harga Jual"] = formatCurrency(updatedTx.hargaJual);
				}
				if (input.dpPanjar !== undefined) {
					rowUpdates["DP/ Panjar"] =
						updatedTx.dpPanjar > 0 ? formatCurrency(updatedTx.dpPanjar) : "";
				}
				if (
					input.sisa !== undefined ||
					input.hargaJual !== undefined ||
					input.dpPanjar !== undefined
				) {
					rowUpdates["sisa"] = updatedTx.sisa > 0 ? formatCurrency(updatedTx.sisa) : "";
				}
				if (input.salesMarketing !== undefined) {
					rowUpdates["Sales/Marketing"] = updatedTx.salesMarketing;
				}
				if (input.statusTransaksi !== undefined || newStatus !== currentTx.statusTransaksi) {
					rowUpdates["Status Transaksi"] = updatedTx.statusTransaksi;
				}
				if (input.catatan !== undefined) {
					rowUpdates["Catatan"] = updatedTx.catatan;
				}

				row.assign(rowUpdates);

				yield* Effect.tryPromise({
					try: () => row.save(),
					catch: (cause) =>
						new SheetsApiError({
							message: `Failed to save updates to transaction #${no}`,
							cause,
						}),
				});

				return updatedTx;
			}),

		delete: (no) =>
			Effect.gen(function* () {
				const sheet = yield* getWorksheet;
				const { row } = yield* findRowByNo(sheet, no);

				yield* Effect.tryPromise({
					try: () => row.delete(),
					catch: (cause) =>
						new SheetsApiError({
							message: `Failed to physically delete row for transaction #${no}`,
							cause,
						}),
				});
			}),
	};
}

// Backward-compatible aliases
export const GoogleSheetsClient = TransactionsServiceTag;
export type GoogleSheetsClient = TransactionsServiceTag;
