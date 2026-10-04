import * as astroPlugin from "prettier-plugin-astro";
import * as sveltePlugin from "prettier-plugin-svelte";
import * as tailwindPlugin from "prettier-plugin-tailwindcss";

/** @type {import("prettier").Config} */
export default {
	plugins: [astroPlugin, sveltePlugin, tailwindPlugin],
	useTabs: true,
	printWidth: 100,
};
