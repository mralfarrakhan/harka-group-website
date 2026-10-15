import { Layer } from 'effect';
import { HttpRouter, HttpServer, HttpServerResponse } from 'effect/http';

const server = HttpRouter.add(
	'GET',
	'*',
	HttpServerResponse.json({
		message: 'Hello, World!',
	}),
).pipe(Layer.provide(HttpServer.layerServices), HttpRouter.toWebHandler);

export default {
	fetch: (request, env, ctx) => server.handler(request),
} satisfies ExportedHandler<Env>;
