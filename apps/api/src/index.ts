import { Console, Effect, Layer } from 'effect';
import { HttpRouter, HttpServer, HttpServerResponse } from 'effect/http';
import { Sheets } from './services';

const server = HttpRouter.addAll([
	HttpRouter.route(
		'GET',
		'*',
		HttpServerResponse.json({
			message: 'Hello, World!',
		}),
	),
	HttpRouter.route(
		'GET',
		'/title',
		Sheets.Client.pipe(
			Effect.flatMap((c) => c.query()),
			Effect.flatMap((s) =>
				HttpServerResponse.json({
					firstSheetTitle: s,
				}),
			),
		),
	),
]);

const app = server.pipe(
	Layer.tapCause(Console.log),
	Layer.provideMerge(Layer.mergeAll(HttpServer.layerServices, Sheets.ClientLive)),
	HttpRouter.toWebHandler,
);

export default {
	fetch: (request, env, ctx) => app.handler(request),
} satisfies ExportedHandler<Env>;

Effect.log('Hello world!');
