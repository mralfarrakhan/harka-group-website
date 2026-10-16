import { Console, Effect, Layer } from 'effect';
import { HttpRouter, HttpServer } from 'effect/http';
import * as Sheets from './sheets';
import { ApiLive } from './server';

const app2 = ApiLive.pipe(
	Layer.tapCause(Console.log),
	Layer.provideMerge(Layer.mergeAll(HttpServer.layerServices, Sheets.ClientLive)),
	HttpRouter.toWebHandler,
);

export default {
	fetch: (request, env, ctx) => app2.handler(request),
} satisfies ExportedHandler<Env>;

Effect.log('Hello world!');
