import { Effect } from "effect";
import { getFilteredCars as getCarsCore, makeCoreLayer } from "@harka/core";
import type { Car } from "~/types";

export const getFilteredCars = async (
	searchParams: Record<string, string>,
	env: Env,
): Promise<Car[]> => {
	const program = getCarsCore(searchParams, { adminView: false }).pipe(
		Effect.provide(makeCoreLayer(env)),
	);
	return (await Effect.runPromise(program)) as Car[];
};
