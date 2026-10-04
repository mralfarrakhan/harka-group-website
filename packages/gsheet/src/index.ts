import { JWT } from "google-auth-library";
import { GoogleSpreadsheet } from "google-spreadsheet";

export const hello = () => console.log("Hello, World!");

export class Client {
	public readonly doc: GoogleSpreadsheet;

	constructor(config: { email: string; key: string; scopes: string | string[]; sheet_id: string }) {
		const auth = new JWT({
			email: config.email,
			key: config.key,
			scopes: config.scopes,
		});

		this.doc = new GoogleSpreadsheet(config.sheet_id, auth);
	}
}
