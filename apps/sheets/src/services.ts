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

export const asSheetsError = (cause: unknown): SheetsError => ({
	message: "Google Sheets operation failed",
	cause,
});

export class GoogleSheetClient extends Context.Service<
	GoogleSheetClient,
	{
		readonly getSheetbyIndex: (
			index: number,
		) => Effect.Effect<NonNullable<GoogleSpreadsheetWorksheet>, SheetsError>;
	}
>()("GoogleSheetClient") {
	static readonly makeLayer = (config: SheetsConfig) =>
		Layer.effect(
			GoogleSheetClient,
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
								catch: asSheetsError,
							}),
					};
				},
				catch: asSheetsError,
			}),
		);
}
