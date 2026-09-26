import { Data } from "effect";

export { R2Error } from "../clients/r2";

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
	readonly cause: unknown;
	readonly message?: string;
}> {}

export class CarNotFoundError extends Data.TaggedError("CarNotFoundError")<{
	readonly id: string;
	readonly message?: string;
}> {}

export class TradeInNotFoundError extends Data.TaggedError("TradeInNotFoundError")<{
	readonly id: string;
	readonly message?: string;
}> {}

export class StorageFileNotFoundError extends Data.TaggedError("StorageFileNotFoundError")<{
	readonly id: string;
	readonly message?: string;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
	readonly message: string;
	readonly details?: unknown;
}> {}
