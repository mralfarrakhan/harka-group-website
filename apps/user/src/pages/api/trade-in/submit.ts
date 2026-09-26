export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Effect, Console } from "effect";
import { submitTradeIn, makeCoreLayer } from "@harka/core";

export const POST: APIRoute = async ({ request }) => {
	try {
		const formData = await request.formData();
		const webhookUrl = (env as unknown as Record<string, unknown>)?.TRADE_IN_WEBHOOK_URL as
			string | undefined;

		const program = submitTradeIn(formData, webhookUrl).pipe(
			Effect.map(
				(result) =>
					new Response(JSON.stringify({ success: true, id: result.id }), {
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
				R2Error: () =>
					Effect.succeed(
						new Response(
							JSON.stringify({
								error: "Gagal mengunggah berkas kendaraan ke penyimpanan server.",
							}),
							{
								status: 502,
								headers: { "Content-Type": "application/json" },
							},
						),
					),
				DatabaseError: () =>
					Effect.succeed(
						new Response(
							JSON.stringify({
								error: "Gagal menyimpan pengajuan ke database.",
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
						event: "trade_in_submit_error",
						cause: cause.toJSON(),
					}),
				).pipe(
					Effect.map(
						() =>
							new Response(
								JSON.stringify({
									error: "Terjadi kesalahan internal saat memproses pengajuan.",
								}),
								{
									status: 500,
									headers: { "Content-Type": "application/json" },
								},
							),
					),
				),
			),
			Effect.provide(makeCoreLayer(env)),
		);

		return await Effect.runPromise(program);
	} catch (err: unknown) {
		const message =
			err instanceof Error ? err.message : "Terjadi kesalahan internal saat memproses pengajuan.";
		return new Response(JSON.stringify({ error: message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
};
