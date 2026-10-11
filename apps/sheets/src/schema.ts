import { Data, Schema } from "effect";
import type { GoogleSpreadsheetRow } from "google-spreadsheet";

// ---------------------------------------------------------------------------
// Tagged Errors
// ---------------------------------------------------------------------------

export class TransactionNotFoundError extends Data.TaggedError("TransactionNotFoundError")<{
	readonly no: number;
	readonly message: string;
}> {}

export class SheetsApiError extends Data.TaggedError("SheetsApiError")<{
	readonly message: string;
	readonly cause?: unknown;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
	readonly message: string;
	readonly details?: unknown;
}> {}

export type TransactionError = TransactionNotFoundError | SheetsApiError | ValidationError;

// ---------------------------------------------------------------------------
// Normalizers & Formatting Helpers
// ---------------------------------------------------------------------------

export function parseDate(val: unknown): string {
	if (val === null || val === undefined || val === "") return "";
	if (typeof val === "number" && !Number.isNaN(val)) {
		// Excel/Google Sheets serial date (e.g. 46235 -> 2026-08-01)
		if (val > 10000 && val < 100000) {
			const utcDays = Math.floor(val - 25569);
			const d = new Date(utcDays * 86400 * 1000);
			return d.toISOString().slice(0, 10);
		}
	}
	const str = String(val).trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
	const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
	if (dmyMatch && dmyMatch[1] && dmyMatch[2] && dmyMatch[3]) {
		const day = dmyMatch[1].padStart(2, "0");
		const month = dmyMatch[2].padStart(2, "0");
		let year = dmyMatch[3];
		if (year.length === 2) {
			year = "20" + year;
		}
		return `${year}-${month}-${day}`;
	}
	return str;
}

export function formatDateForSheet(isoDate: string): string {
	if (!isoDate) return "";
	const parts = isoDate.split("-");
	if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
		const [year, month, day] = parts;
		const shortYear = year.slice(2);
		return `${Number(day)}/${month.padStart(2, "0")}/${shortYear}`;
	}
	return isoDate;
}

export function parseCurrency(val: unknown): number {
	if (val === null || val === undefined || val === "") return 0;
	if (typeof val === "number" && !Number.isNaN(val)) return Math.round(val);
	const str = String(val).replace(/[^0-9\-]/g, "");
	if (!str) return 0;
	const num = parseInt(str, 10);
	return Number.isNaN(num) ? 0 : num;
}

export function formatCurrency(val: number): string {
	return `Rp${val.toLocaleString("id-ID")}`;
}

export function parsePhone(val: unknown): string {
	if (val === null || val === undefined || val === "") return "";
	let str = String(val)
		.trim()
		.replace(/[^0-9\+]/g, "");
	if (str.startsWith("+62")) {
		str = "0" + str.slice(3);
	} else if (str.startsWith("62")) {
		str = "0" + str.slice(2);
	} else if (str.startsWith("8")) {
		str = "0" + str;
	}
	return str;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const TransactionSchema = Schema.Struct({
	no: Schema.Number,
	tanggalTransaksi: Schema.String,
	deskripsiMobil: Schema.String,
	platMobil: Schema.String,
	kategoriTransaksi: Schema.String,
	namaPembeli: Schema.String,
	nomorTelpon: Schema.String,
	hargaJual: Schema.Number,
	dpPanjar: Schema.Number,
	sisa: Schema.Number,
	salesMarketing: Schema.String,
	statusTransaksi: Schema.String,
	catatan: Schema.String,
});

export type Transaction = Schema.Schema.Type<typeof TransactionSchema>;

export const CreateTransactionSchema = Schema.Struct({
	tanggalTransaksi: Schema.optionalWith(Schema.String, {
		default: () => new Date().toISOString().slice(0, 10),
	}),
	deskripsiMobil: Schema.String,
	platMobil: Schema.String,
	kategoriTransaksi: Schema.optionalWith(Schema.String, { default: () => "JUAL CASH LUNAS" }),
	namaPembeli: Schema.String,
	nomorTelpon: Schema.optionalWith(Schema.String, { default: () => "" }),
	hargaJual: Schema.Number,
	dpPanjar: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	sisa: Schema.optional(Schema.Number),
	salesMarketing: Schema.optionalWith(Schema.String, { default: () => "" }),
	statusTransaksi: Schema.optional(Schema.String),
	catatan: Schema.optionalWith(Schema.String, { default: () => "" }),
});

export type CreateTransactionInput = Schema.Schema.Type<typeof CreateTransactionSchema>;

export const UpdateTransactionSchema = Schema.partial(
	Schema.Struct({
		tanggalTransaksi: Schema.String,
		deskripsiMobil: Schema.String,
		platMobil: Schema.String,
		kategoriTransaksi: Schema.String,
		namaPembeli: Schema.String,
		nomorTelpon: Schema.String,
		hargaJual: Schema.Number,
		dpPanjar: Schema.Number,
		sisa: Schema.Number,
		salesMarketing: Schema.String,
		statusTransaksi: Schema.String,
		catatan: Schema.String,
	}),
);

export type UpdateTransactionInput = Schema.Schema.Type<typeof UpdateTransactionSchema>;

// ---------------------------------------------------------------------------
// Google Sheet Column Mappings
// ---------------------------------------------------------------------------

export const TRANSAKSI_HEADERS = [
	"No",
	"Tanggal Transaksi",
	"Deskripsi Mobil",
	"Plat mobil",
	"Kategori Transaksi",
	"Nama Pembeli",
	"Nomor Telpon",
	"Harga Jual",
	"DP/ Panjar",
	"sisa",
	"Sales/Marketing",
	"Status Transaksi",
	"Catatan",
] as const;

export function mapRowToTransaction(row: GoogleSpreadsheetRow): Transaction {
	const get = (col: string): unknown => row.get(col);

	const statusTransaksi = String(get("Status Transaksi") || "").trim();
	const kategoriTransaksi = String(get("Kategori Transaksi") || "").trim();
	const hargaJual = parseCurrency(get("Harga Jual"));
	const dpPanjar = parseCurrency(get("DP/ Panjar"));
	const rawSisa = get("sisa");

	let sisa = 0;
	if (rawSisa !== "" && rawSisa !== null && rawSisa !== undefined) {
		sisa = parseCurrency(rawSisa);
	} else if (
		statusTransaksi.toUpperCase() === "LUNAS" ||
		kategoriTransaksi.toUpperCase().includes("LUNAS")
	) {
		sisa = 0;
	} else if (dpPanjar > 0) {
		sisa = Math.max(0, hargaJual - dpPanjar);
	} else {
		sisa = hargaJual;
	}

	const noRaw = get("No");
	const no = typeof noRaw === "number" ? noRaw : parseInt(String(noRaw || "0"), 10) || 0;

	return {
		no,
		tanggalTransaksi: parseDate(get("Tanggal Transaksi")),
		deskripsiMobil: String(get("Deskripsi Mobil") || "").trim(),
		platMobil: String(get("Plat mobil") || "").trim(),
		kategoriTransaksi: String(get("Kategori Transaksi") || "").trim(),
		namaPembeli: String(get("Nama Pembeli") || "").trim(),
		nomorTelpon: parsePhone(get("Nomor Telpon")),
		hargaJual,
		dpPanjar,
		sisa,
		salesMarketing: String(get("Sales/Marketing") || "").trim(),
		statusTransaksi: String(get("Status Transaksi") || "").trim(),
		catatan: String(get("Catatan") || "").trim(),
	};
}

export function mapTransactionToRowData(tx: Partial<Transaction>): Record<string, string | number> {
	const data: Record<string, string | number> = {};

	if (tx.no !== undefined) data["No"] = tx.no;
	if (tx.tanggalTransaksi !== undefined) {
		data["Tanggal Transaksi"] = formatDateForSheet(tx.tanggalTransaksi);
	}
	if (tx.deskripsiMobil !== undefined) data["Deskripsi Mobil"] = tx.deskripsiMobil;
	if (tx.platMobil !== undefined) data["Plat mobil"] = tx.platMobil;
	if (tx.kategoriTransaksi !== undefined) data["Kategori Transaksi"] = tx.kategoriTransaksi;
	if (tx.namaPembeli !== undefined) data["Nama Pembeli"] = tx.namaPembeli;
	if (tx.nomorTelpon !== undefined) data["Nomor Telpon"] = parsePhone(tx.nomorTelpon);
	if (tx.hargaJual !== undefined) {
		data["Harga Jual"] = formatCurrency(tx.hargaJual);
	}
	if (tx.dpPanjar !== undefined) {
		data["DP/ Panjar"] = tx.dpPanjar > 0 ? formatCurrency(tx.dpPanjar) : "";
	}
	if (tx.sisa !== undefined) {
		data["sisa"] = tx.sisa > 0 ? formatCurrency(tx.sisa) : "";
	}
	if (tx.salesMarketing !== undefined) data["Sales/Marketing"] = tx.salesMarketing;
	if (tx.statusTransaksi !== undefined) data["Status Transaksi"] = tx.statusTransaksi;
	if (tx.catatan !== undefined) data["Catatan"] = tx.catatan;

	return data;
}
