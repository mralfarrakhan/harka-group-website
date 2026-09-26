export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Effect, Console } from "effect";
import { getFilteredCars, makeCoreLayer } from "@harka/core";

export const GET: APIRoute = ({ request }) => {
	const start = performance.now();
	const url = new URL(request.url);
	const searchParams = Object.fromEntries(url.searchParams.entries());

	const program = getFilteredCars(searchParams, {
		adminView: true,
		includeHidden: true,
		includeDeleted: false,
	}).pipe(
		Effect.map((allCars) => {
			const duration = performance.now() - start;

			if (!allCars || allCars.length === 0) {
				return new Response(JSON.stringify({ error: "Mobil tidak ditemukan", allCars: [] }), {
					status: 404,
					headers: { "content-type": "application/json" },
				});
			}

			return new Response(
				JSON.stringify({
					performance: { "Total time": duration },
					allCars,
				}),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		}),
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
					event: "admin_filter_cars_error",
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
