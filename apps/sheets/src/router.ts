import { Effect, Schema } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { CreateTransactionSchema, UpdateTransactionSchema, ValidationError } from "./schema";
import { TransactionsServiceTag } from "./services";

const decodeCreate = Schema.decodeUnknown(CreateTransactionSchema);
const decodeUpdate = Schema.decodeUnknown(UpdateTransactionSchema);

export const transactionsRouter = HttpRouter.empty.pipe(
	// Health check
	HttpRouter.get("/health", HttpServerResponse.text("ok")),
	HttpRouter.get("/api/health", HttpServerResponse.text("ok")),

	// List transactions
	HttpRouter.get(
		"/api/transactions",
		Effect.gen(function* () {
			const req = yield* HttpServerRequest.HttpServerRequest;
			const service = yield* TransactionsServiceTag;

			const url = new URL(req.url, "http://localhost");
			const status = url.searchParams.get("status") || undefined;
			const search = url.searchParams.get("search") || undefined;

			const data = yield* service.list({ status, search });
			return yield* HttpServerResponse.json({ data });
		}),
	),
	HttpRouter.get(
		"/transactions",
		Effect.gen(function* () {
			const req = yield* HttpServerRequest.HttpServerRequest;
			const service = yield* TransactionsServiceTag;

			const url = new URL(req.url, "http://localhost");
			const status = url.searchParams.get("status") || undefined;
			const search = url.searchParams.get("search") || undefined;

			const data = yield* service.list({ status, search });
			return yield* HttpServerResponse.json({ data });
		}),
	),

	// Get single transaction by No
	HttpRouter.get(
		"/api/transactions/:no",
		Effect.gen(function* () {
			const ctx = yield* HttpRouter.RouteContext;
			const service = yield* TransactionsServiceTag;

			const no = parseInt(ctx.params.no || "", 10);
			if (Number.isNaN(no) || no <= 0) {
				return yield* new ValidationError({
					message: `Invalid transaction number "${ctx.params.no}"`,
				});
			}

			const data = yield* service.getByNo(no);
			return yield* HttpServerResponse.json({ data });
		}),
	),
	HttpRouter.get(
		"/transactions/:no",
		Effect.gen(function* () {
			const ctx = yield* HttpRouter.RouteContext;
			const service = yield* TransactionsServiceTag;

			const no = parseInt(ctx.params.no || "", 10);
			if (Number.isNaN(no) || no <= 0) {
				return yield* new ValidationError({
					message: `Invalid transaction number "${ctx.params.no}"`,
				});
			}

			const data = yield* service.getByNo(no);
			return yield* HttpServerResponse.json({ data });
		}),
	),

	// Create transaction
	HttpRouter.post(
		"/api/transactions",
		Effect.gen(function* () {
			const req = yield* HttpServerRequest.HttpServerRequest;
			const service = yield* TransactionsServiceTag;

			const rawBody = yield* req.json.pipe(
				Effect.mapError(
					(cause) =>
						new ValidationError({
							message: "Invalid JSON request body",
							details: cause,
						}),
				),
			);

			const validated = yield* decodeCreate(rawBody).pipe(
				Effect.mapError(
					(err) =>
						new ValidationError({
							message: "Validation failed for transaction payload",
							details: err,
						}),
				),
			);

			const data = yield* service.create(validated);
			return yield* HttpServerResponse.json({ data }, { status: 201 });
		}),
	),
	HttpRouter.post(
		"/transactions",
		Effect.gen(function* () {
			const req = yield* HttpServerRequest.HttpServerRequest;
			const service = yield* TransactionsServiceTag;

			const rawBody = yield* req.json.pipe(
				Effect.mapError(
					(cause) =>
						new ValidationError({
							message: "Invalid JSON request body",
							details: cause,
						}),
				),
			);

			const validated = yield* decodeCreate(rawBody).pipe(
				Effect.mapError(
					(err) =>
						new ValidationError({
							message: "Validation failed for transaction payload",
							details: err,
						}),
				),
			);

			const data = yield* service.create(validated);
			return yield* HttpServerResponse.json({ data }, { status: 201 });
		}),
	),

	// Update transaction
	HttpRouter.patch(
		"/api/transactions/:no",
		Effect.gen(function* () {
			const ctx = yield* HttpRouter.RouteContext;
			const req = yield* HttpServerRequest.HttpServerRequest;
			const service = yield* TransactionsServiceTag;

			const no = parseInt(ctx.params.no || "", 10);
			if (Number.isNaN(no) || no <= 0) {
				return yield* new ValidationError({
					message: `Invalid transaction number "${ctx.params.no}"`,
				});
			}

			const rawBody = yield* req.json.pipe(
				Effect.mapError(
					(cause) =>
						new ValidationError({
							message: "Invalid JSON request body",
							details: cause,
						}),
				),
			);

			const validated = yield* decodeUpdate(rawBody).pipe(
				Effect.mapError(
					(err) =>
						new ValidationError({
							message: "Validation failed for update payload",
							details: err,
						}),
				),
			);

			const data = yield* service.update(no, validated);
			return yield* HttpServerResponse.json({ data });
		}),
	),
	HttpRouter.patch(
		"/transactions/:no",
		Effect.gen(function* () {
			const ctx = yield* HttpRouter.RouteContext;
			const req = yield* HttpServerRequest.HttpServerRequest;
			const service = yield* TransactionsServiceTag;

			const no = parseInt(ctx.params.no || "", 10);
			if (Number.isNaN(no) || no <= 0) {
				return yield* new ValidationError({
					message: `Invalid transaction number "${ctx.params.no}"`,
				});
			}

			const rawBody = yield* req.json.pipe(
				Effect.mapError(
					(cause) =>
						new ValidationError({
							message: "Invalid JSON request body",
							details: cause,
						}),
				),
			);

			const validated = yield* decodeUpdate(rawBody).pipe(
				Effect.mapError(
					(err) =>
						new ValidationError({
							message: "Validation failed for update payload",
							details: err,
						}),
				),
			);

			const data = yield* service.update(no, validated);
			return yield* HttpServerResponse.json({ data });
		}),
	),

	// Delete transaction
	HttpRouter.del(
		"/api/transactions/:no",
		Effect.gen(function* () {
			const ctx = yield* HttpRouter.RouteContext;
			const service = yield* TransactionsServiceTag;

			const no = parseInt(ctx.params.no || "", 10);
			if (Number.isNaN(no) || no <= 0) {
				return yield* new ValidationError({
					message: `Invalid transaction number "${ctx.params.no}"`,
				});
			}

			yield* service.delete(no);
			return yield* HttpServerResponse.json({ success: true, deleted: no });
		}),
	),
	HttpRouter.del(
		"/transactions/:no",
		Effect.gen(function* () {
			const ctx = yield* HttpRouter.RouteContext;
			const service = yield* TransactionsServiceTag;

			const no = parseInt(ctx.params.no || "", 10);
			if (Number.isNaN(no) || no <= 0) {
				return yield* new ValidationError({
					message: `Invalid transaction number "${ctx.params.no}"`,
				});
			}

			yield* service.delete(no);
			return yield* HttpServerResponse.json({ success: true, deleted: no });
		}),
	),

	// Error handling mapping domain errors to HTTP responses
	HttpRouter.catchTags({
		TransactionNotFoundError: (err) =>
			HttpServerResponse.json({ error: err.message, no: err.no }, { status: 404 }),
		ValidationError: (err) =>
			HttpServerResponse.json({ error: err.message, details: err.details }, { status: 400 }),
		SheetsApiError: (err) => HttpServerResponse.json({ error: err.message }, { status: 502 }),
	}),
	HttpRouter.catchAll((err) =>
		HttpServerResponse.json(
			{ error: "Internal server error", message: String(err) },
			{ status: 500 },
		),
	),
);
