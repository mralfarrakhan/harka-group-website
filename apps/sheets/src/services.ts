import { Context, Effect, Layer } from "effect";
import { JWT } from "google-auth-library";
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from "google-spreadsheet";

type SheetsConfig = {
	readonly email: string;
	readonly privateKey: string;
	readonly spreadsheetId: string;
};

type SheetsError = {
	readonly message: string;
	readonly cause: unknown;
};

export const makeSheetsError =
	(message?: string) =>
	(cause: unknown): SheetsError => ({
		message: message ?? "Google Sheets operation failed",
		cause,
	});

export class GoogleSheetsClient extends Context.Tag("GoogleSheetsClient")<
	GoogleSheetsClient,
	{
		readonly getSheetbyIndex: (
			index: number,
		) => Effect.Effect<NonNullable<GoogleSpreadsheetWorksheet>, SheetsError>;
	}
>() {
	static readonly makeLayer = (config: SheetsConfig) =>
		Layer.effect(
			GoogleSheetsClient,
			Effect.tryPromise({
				try: async () => {
					const auth = new JWT({
						email: config.email,
						key: config.privateKey,
						scopes: ["https://www.googleapis.com/auth/spreadsheets"],
					});

					const doc = new GoogleSpreadsheet(config.spreadsheetId, auth);

					await doc.loadInfo();

					return {
						getSheetbyIndex: (index) =>
							Effect.try({
								try: () => {
									const sheet = doc.sheetsByIndex[index];
									if (!sheet) {
										throw new Error(`Sheet at index ${index} not found`);
									}
									return sheet;
								},
								catch: makeSheetsError(),
							}),
					};
				},
				catch: makeSheetsError("Error in client initialization"),
			}),
		);
}
