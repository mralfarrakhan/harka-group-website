import { Effect } from "effect";
import { GoogleSheetsClient } from "./services";
import { HttpApp, HttpRouter, HttpServerResponse } from "@effect/platform";

const firstSheet = GoogleSheetsClient.pipe(Effect.flatMap((c) => c.getSheetbyIndex(0)));

const server = HttpRouter.empty.pipe(
	HttpRouter.get("/", HttpServerResponse.text("ok")),
	HttpApp.toWebHandler,
);

export default {
	fetch: (response) => server(response),
} satisfies ExportedHandler<Env>;
