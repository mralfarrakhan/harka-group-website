import { JWT } from "google-auth-library";
import { GoogleSpreadsheet } from "google-spreadsheet";

export const hello = () => console.log("Hello, World!");

export interface ClientConfig {
	email: string;
	key: string;
	scopes: string | string[];
	sheet_id: string;
}

export class Client {
	public readonly doc: GoogleSpreadsheet;

	constructor(config: ClientConfig) {
		const auth = new JWT({
			email: config.email,
			key: config.key,
			scopes: config.scopes,
		});

		this.doc = new GoogleSpreadsheet(config.sheet_id, auth);
	}
}
