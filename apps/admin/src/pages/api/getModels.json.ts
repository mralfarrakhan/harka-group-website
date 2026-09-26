export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Effect, Console } from "effect";
import { getDistinctModelsByMake, makeCoreLayer } from "@harka/core";

export const GET: APIRoute = ({ request }) => {
	const url = new URL(request.url);
	const make = url.searchParams.get("make");

	if (!make) {
		return new Response(JSON.stringify({ error: "Parameter pencarian tidak valid" }), {
			status: 400,
			headers: { "content-type": "application/json" },
		});
	}

	const program = getDistinctModelsByMake(make, true).pipe(
		Effect.map(
			(models) =>
				new Response(JSON.stringify(models), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		),
		Effect.catchTags({
			ValidationError: (err) =>
				Effect.succeed(
					new Response(JSON.stringify({ error: err.message }), {
						status: 400,
						headers: { "content-type": "application/json" },
					}),
				),
			DatabaseError: () =>
				Effect.succeed(
					new Response(JSON.stringify({ error: "Database error" }), {
						status: 500,
						headers: { "content-type": "application/json" },
					}),
				),
		}),
		Effect.catchAllCause((cause) =>
			Console.error(
				JSON.stringify({
					event: "admin_get_models_error",
					cause: cause.toJSON(),
				}),
			).pipe(
				Effect.map(
					() =>
						new Response(JSON.stringify({ error: "Internal Server Error" }), {
							status: 500,
							headers: { "content-type": "application/json" },
						}),
				),
			),
		),
		Effect.provide(makeCoreLayer(env)),
	);

	return Effect.runPromise(program);
};
