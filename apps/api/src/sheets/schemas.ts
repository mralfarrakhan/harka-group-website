import { Schema, Struct } from 'effect';

export const TransactionCategory = Schema.Literals(['JUAL CASH LUNAS', 'TERIMA DP PEMBELI', 'TUKAR TAMBAH']);
export const TransactionStatus = Schema.Literals(['LUNAS', 'BELUM LUNAS']);

export const Transaction = Schema.Struct({
	no: Schema.Finite,
	transactionDate: Schema.DateFromString,
	carDescription: Schema.String,
	plateNumber: Schema.String,
	category: TransactionCategory,
	buyerName: Schema.String,
	phoneNumber: Schema.String,
	sellingPrice: Schema.Finite,
	downPayment: Schema.OptionFromOptionalNullOr(Schema.Finite),
	remainingBalance: Schema.OptionFromOptionalNullOr(Schema.Finite),
	salesPerson: Schema.String,
	status: TransactionStatus,
	notes: Schema.OptionFromOptionalNullOr(Schema.String),
});

export const TransactionRequest = Transaction.mapFields(Struct.omit(['no']));

export const TransactionSheet = Schema.Struct({
	...Transaction.fields,
	no: Schema.FiniteFromString,
	sellingPrice: Schema.FiniteFromString,
	downPayment: Schema.OptionFromOptionalNullOr(Schema.FiniteFromString),
	remainingBalance: Schema.OptionFromOptionalNullOr(Schema.FiniteFromString),
}).pipe(
	Schema.encodeKeys({
		no: 'No',
		transactionDate: 'Tanggal Transaksi',
		carDescription: 'Deskripsi Mobil',
		plateNumber: 'Plat mobil',
		category: 'Kategori Transaksi',
		buyerName: 'Nama Pembeli',
		phoneNumber: 'Nomor Telpon',
		sellingPrice: 'Harga Jual',
		downPayment: 'DP/ Panjar',
		remainingBalance: 'sisa',
		salesPerson: 'Sales/Marketing',
		status: 'Status Transaksi',
		notes: 'Catatan',
	}),
);

export type TransactionType = typeof Transaction.Type;

export type TransactionRequestType = typeof TransactionRequest.Type;

export type TransactionSheetType = typeof TransactionSheet.Encoded;
