import { Effect } from "effect";
import { GoogleSheetClient } from "./services";
import { HttpApp, HttpRouter, HttpServerResponse } from "@effect/platform";

const firstSheet = GoogleSheetClient.pipe(Effect.flatMap((c) => c.getSheetbyIndex(0)));

const server = HttpRouter.empty.pipe(
	HttpRouter.get("/", HttpServerResponse.text("ok")),
	HttpApp.toWebHandler,
);

export default {
	fetch: (response) => server(response),
} satisfies ExportedHandler<Env>;
