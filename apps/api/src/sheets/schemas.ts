import { Schema, Struct } from 'effect';

export const Transaction = Schema.Struct({
	No: Schema.FiniteFromString,
	'Tanggal Transaksi': Schema.DateFromString,
	'Deskripsi Mobil': Schema.String,
	'Plat mobil': Schema.String,
	'Kategori Transaksi': Schema.Literals(['JUAL CASH LUNAS', 'TERIMA DP PEMBELI', 'TUKAR TAMBAH']),
	'Nama Pembeli': Schema.String,
	'Nomor Telpon': Schema.String,
	'Harga Jual': Schema.FiniteFromString,
	'DP/ Panjar': Schema.OptionFromOptional(Schema.FiniteFromString),
	sisa: Schema.OptionFromOptional(Schema.FiniteFromString),
	'Sales/Marketing': Schema.String,
	'Status Transaksi': Schema.Literals(['LUNAS', 'BELUM LUNAS']),
	Catatan: Schema.String,
});

export const TransactionRequest = Transaction.mapFields(Struct.omit(['No']));

export type TransactionType = typeof Transaction.Type;

export type TransactionRequestType = typeof TransactionRequest.Type;
