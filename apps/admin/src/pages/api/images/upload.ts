import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Effect, Console } from "effect";
import { uploadGalleryImages, makeCoreLayer } from "@harka/core";

export const POST: APIRoute = async ({ request }) => {
	const formData = await request.formData();
	const files = formData.getAll("file") as File[];

	const program = uploadGalleryImages(files).pipe(
		Effect.map(
			(urls) =>
				new Response(JSON.stringify({ success: true, urls }), {
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
					new Response(JSON.stringify({ error: "Gagal mengunggah foto ke storage" }), {
						status: 502,
						headers: { "Content-Type": "application/json" },
					}),
				),
		}),
		Effect.catchAllCause((cause) =>
			Console.error(
				JSON.stringify({
					event: "image_upload_error",
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
