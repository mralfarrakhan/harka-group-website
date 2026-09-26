import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Effect, Console } from "effect";
import { createCar, makeCoreLayer } from "@harka/core";

export const POST: APIRoute = async ({ request }) => {
	const rawJson = await request.json();

	const program = createCar(rawJson).pipe(
		Effect.map(
			(result) =>
				new Response(JSON.stringify({ success: true, id: result.id, redirect: "/cars" }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
		),
		Effect.catchTags({
			ValidationError: (err) =>
				Effect.succeed(
					new Response(JSON.stringify({ error: err.message }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					}),
				),
			DatabaseError: () =>
				Effect.succeed(
					new Response(JSON.stringify({ error: "Gagal menambahkan kendaraan ke database" }), {
						status: 500,
						headers: { "Content-Type": "application/json" },
					}),
				),
		}),
		Effect.catchAllCause((cause) =>
			Console.error(
				JSON.stringify({
					event: "admin_create_car_error",
					cause: cause.toJSON(),
				}),
			).pipe(
				Effect.map(
					() =>
						new Response(JSON.stringify({ error: "Internal Server Error" }), {
							status: 500,
							headers: { "Content-Type": "application/json" },
						}),
				),
			),
		),
		Effect.provide(makeCoreLayer(env)),
	);

	return Effect.runPromise(program);
};
