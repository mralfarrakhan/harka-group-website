import { flow, Schema, Struct } from 'effect';
import { DDMMYY, OptionFromEmptyStringOr, RpFromString } from './utilities';

export const TransactionCategory = Schema.Literals(['JUAL CASH LUNAS', 'TERIMA DP PEMBELI', 'TUKAR TAMBAH']);
export const TransactionStatus = Schema.Literals(['LUNAS', 'BELUM LUNAS']);

export const Transaction = Schema.Struct({
	no: Schema.Finite.check(Schema.isGreaterThan(0)),
	transactionDate: DDMMYY,
	carDescription: Schema.String,
	plateNumber: Schema.String.check(Schema.isPattern(/^([A-Za-z]{1,2})\s*([1-9][0-9]{0,3})\s*([A-Za-z]{0,3})$/)),
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
export const TransactionCreate = Transaction.mapFields(Struct.omit(['no']));
export const TransactionRead = Transaction.mapFields(flow(Struct.pick(['no']), Struct.map(Schema.optionalKey)));
export const TransactionUpdate = Transaction.mapFields(Struct.mapOmit(['no'], Schema.optionalKey));
export const TransactionDelete = Transaction.mapFields(Struct.pick(['no']));

export const TransactionSheet = Schema.Struct({
	...Transaction.fields,
	no: Schema.FiniteFromString,
	sellingPrice: RpFromString,
	downPayment: OptionFromEmptyStringOr(RpFromString),
	remainingBalance: OptionFromEmptyStringOr(RpFromString),
	notes: OptionFromEmptyStringOr(Schema.String),
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

export type TransactionSheetType = typeof TransactionSheet.Encoded;
