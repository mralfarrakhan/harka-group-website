import { Schema } from 'effect';

export const TransactionRequest = Schema.Struct({
	No: Schema.Finite,
	'Tanggal Transaksi': Schema.Date,
	'Deskripsi Mobil': Schema.String,
	'Plat mobil': Schema.String,
	'Kategori Transaksi': Schema.Literals(['JUAL CASH LUNAS', 'TERIMA DP PEMBELI', 'TUKAR TAMBAH']),
	'Nama Pembeli': Schema.String,
	'Nomor Telpon': Schema.String,
	'Harga Jual': Schema.FiniteFromString,
	'DP/ Panjar': Schema.FiniteFromString,
	sisa: Schema.FiniteFromString,
	'Sales/Marketing': Schema.String,
	'Status Transaksi': Schema.Literals(['LUNAS', 'BELUM LUNAS']),
	Catatan: Schema.String,
});

export type TransactionRequestType = typeof TransactionRequest.Type;
