import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Effect, Console } from "effect";
import { updateTradeInStatus, makeCoreLayer } from "@harka/core";

const handleUpdateStatus: APIRoute = async ({ request, params, locals }) => {
	const id = params.id as string;
	const rawJson = await request.json();
	const reviewer = locals.user?.email || locals.user?.name || "Admin";

	const program = updateTradeInStatus(id, rawJson, reviewer).pipe(
		Effect.map(
			(result) =>
				new Response(JSON.stringify(result), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
		),
		Effect.catchTags({
			TradeInNotFoundError: (err) =>
				Effect.succeed(
					new Response(
						JSON.stringify({
							error: `Pengajuan ID ${err.id} tidak ditemukan`,
						}),
						{
							status: 404,
							headers: { "Content-Type": "application/json" },
						},
					),
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
					new Response(
						JSON.stringify({
							error: "Gagal memperbarui status pengajuan di database",
						}),
						{
							status: 500,
							headers: { "Content-Type": "application/json" },
						},
					),
				),
		}),
		Effect.catchAllCause((cause) =>
			Console.error(
				JSON.stringify({
					event: "admin_trade_in_status_error",
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

export const PATCH: APIRoute = handleUpdateStatus;
export const POST: APIRoute = handleUpdateStatus;
