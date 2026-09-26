export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Effect, Console } from "effect";
import { streamImage, makeCoreLayer } from "@harka/core";

export const GET: APIRoute = ({ params }) => {
	const id = params.id as string;
	const program = streamImage(id).pipe(
		Effect.map((res) => new Response(res.body as unknown as BodyInit, { headers: res.headers })),
		Effect.catchTags({
			ValidationError: (err) => Effect.succeed(new Response(err.message, { status: 400 })),
			StorageFileNotFoundError: () =>
				Effect.succeed(new Response("Image not found", { status: 404 })),
			R2Error: () => Effect.succeed(new Response("Storage Error", { status: 502 })),
		}),
		Effect.catchAllCause((cause) =>
			Console.error(
				JSON.stringify({
					event: "image_stream_error",
					cause: cause.toJSON(),
				}),
			).pipe(Effect.map(() => new Response("Internal Server Error", { status: 500 }))),
		),
		Effect.provide(makeCoreLayer(env)),
	);

	return Effect.runPromise(program);
};
