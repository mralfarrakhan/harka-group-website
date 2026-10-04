import { HttpRouter } from "effect/http";

export default {
	fetch: () => new Response(`Running in ${navigator.userAgent}!`),
} satisfies ExportedHandler<Env>;
