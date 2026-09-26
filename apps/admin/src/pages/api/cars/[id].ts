import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Effect, Console } from "effect";
import { updateCar, softDeleteCar, hardDeleteCar, makeCoreLayer } from "@harka/core";

export const PUT: APIRoute = async ({ request, params }) => {
	const id = params.id as string;
	const rawJson = await request.json();

	const program = updateCar(id, rawJson).pipe(
		Effect.map(
			() =>
				new Response(JSON.stringify({ success: true, redirect: "/cars" }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
		),
		Effect.catchTags({
			CarNotFoundError: (err) =>
				Effect.succeed(
					new Response(JSON.stringify({ error: `Mobil ID ${err.id} tidak ditemukan` }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					}),
				),
			ValidationError: (err) =>
				Effect.succeed(
					new Response(JSON.stringify({ error: err.message }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					}),
				),
			DatabaseError: () =>
				Effect.succeed(
					new Response(JSON.stringify({ error: "Gagal memperbarui kendaraan di database" }), {
						status: 500,
						headers: { "Content-Type": "application/json" },
					}),
				),
		}),
		Effect.catchAllCause((cause) =>
			Console.error(
				JSON.stringify({
					event: "admin_update_car_error",
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

export const DELETE: APIRoute = ({ request, params }) => {
	const id = params.id as string;
	const url = new URL(request.url);
	const reason = (url.searchParams.get("reason") as "sold" | "removed" | "delete") || "removed";

	const deleteEffect = reason === "delete" ? hardDeleteCar(id) : softDeleteCar(id, reason);

	const program = deleteEffect.pipe(
		Effect.map(
			() =>
				new Response(JSON.stringify({ success: true, redirect: "/cars" }), {
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
					new Response(JSON.stringify({ error: "Gagal menghapus kendaraan dari database" }), {
						status: 500,
						headers: { "Content-Type": "application/json" },
					}),
				),
		}),
		Effect.catchAllCause((cause) =>
			Console.error(
				JSON.stringify({
					event: "admin_delete_car_error",
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
