import { HttpApp, HttpRouter } from "@effect/platform";
import { transactionsRouter } from "./router";
import { makeTransactionsService, TransactionsServiceTag } from "./services";

const makeServer = (env: Env) => {};

export default {
	fetch: async (request, env) => {
		const config = {
			email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
			privateKey: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
			spreadsheetId: env.GOOGLE_SHEET_ID,
		};

		const service = makeTransactionsService(config);

		const app = transactionsRouter.pipe(
			HttpRouter.provideService(TransactionsServiceTag, service),
			HttpApp.toWebHandler,
		);

		return app(request);
	},
} satisfies ExportedHandler<Env>;
