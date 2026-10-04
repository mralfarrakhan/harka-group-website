export default {
	fetch: () => new Response(`Running in ${navigator.userAgent}!`),
} satisfies ExportedHandler<Env>;
