import { Console, Effect, Layer, Logger } from 'effect';
import { HttpRouter, HttpServer } from 'effect/http';
import * as Sheets from './sheets';
import { ApiLive } from './server';

const app2 = ApiLive.pipe(
	Layer.provideMerge(Layer.mergeAll(HttpServer.layerServices, Sheets.ClientLive, Logger.layer([Logger.consoleJson]))),
	HttpRouter.toWebHandler,
);

export default {
	fetch: (request, env, ctx) => app2.handler(request),
} satisfies ExportedHandler<Env>;

Effect.log('Hello world!');
