import { FakeAdapter } from "@tests/http/fake-adapter";
import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { AccountsApi } from "@/accounts/accounts-api";
import type { CancelSignal } from "@/accounts/types";
import { AuthTokenError } from "@/errors/auth-token-error";
import { HttpError } from "@/errors/http-error";
import { NetworkError } from "@/errors/network-error";
import { ValidationError } from "@/errors/validation-error";
import { HttpClient } from "@/http/http-client";

const BASE = "https://copilot.example.com";
const ACCOUNTS = `${BASE}/api/admin/accounts`;
const ID = "3f2b8c1e-9a4d-4e6b-8c2f-1a2b3c4d5e6f";
const ACCOUNT = {
	id: ID,
	name: "Acme",
	logoUrl: "https://cdn.example.com/acme.png",
	createdAt: "2026-10-03T09:15:00Z",
};
const INPUT = { name: "Acme", logoUrl: "https://cdn.example.com/acme.png" };

function setup(): {
	accounts: AccountsApi;
	http: HttpClient;
	fake: FakeAdapter;
	providerCalls: () => number;
} {
	const fake = new FakeAdapter();
	const http = new HttpClient(BASE, { adapter: fake.adapter });
	let calls = 0;
	http.setAuthTokenProvider(async () => {
		calls += 1;
		return "t0k3n";
	});
	return {
		accounts: new AccountsApi(http),
		http,
		fake,
		providerCalls: () => calls,
	};
}

// A class instance, like a real AbortSignal: axios clones plain objects in
// its config but passes class instances through as is.
class StubSignal implements CancelSignal {
	constructor(readonly aborted: boolean) {}
	onabort = null;
	addEventListener(): void {}
	removeEventListener(): void {}
}

describe("AccountsApi", () => {
	describe("list", () => {
		// covers: AC-1, AC-2
		it("sends GET /api/admin/accounts with the bearer token and resolves parsed accounts", async () => {
			// Arrange
			const { accounts, fake } = setup();
			fake.respondWith({ status: 200, data: [ACCOUNT] });

			// Act
			const result = await accounts.list();

			// Assert
			expect(result).toEqual([ACCOUNT]);
			expect(fake.requests[0]?.method).toBe("get");
			expect(fake.requests[0]?.url).toBe(ACCOUNTS);
			expect(fake.requests[0]?.headers.Authorization).toBe("Bearer t0k3n");
		});

		// covers: AC-2
		it("resolves an empty array", async () => {
			// Arrange
			const { accounts, fake } = setup();
			fake.respondWith({ status: 200, data: [] });

			// Act
			const result = await accounts.list();

			// Assert
			expect(result).toEqual([]);
		});

		// covers: AC-1
		it("sends no Authorization header when no provider is set", async () => {
			// Arrange
			const fake = new FakeAdapter();
			const accounts = new AccountsApi(
				new HttpClient(BASE, { adapter: fake.adapter }),
			);
			fake.respondWith({ status: 200, data: [] });

			// Act
			await accounts.list();

			// Assert
			expect(fake.requests[0]?.headers.Authorization).toBeUndefined();
		});

		// covers: AC-7
		it("accepts null name and logoUrl and strips unknown keys", async () => {
			// Arrange
			const { accounts, fake } = setup();
			fake.respondWith({
				status: 200,
				data: [{ ...ACCOUNT, name: null, logoUrl: null, tenant: "x" }],
			});

			// Act
			const result = await accounts.list();

			// Assert
			expect(result).toEqual([{ ...ACCOUNT, name: null, logoUrl: null }]);
		});

		// covers: AC-7, AC-10, AC-11
		describe("response drift", () => {
			const { createdAt: _, ...withoutCreatedAt } = ACCOUNT;
			const drifts: [string, unknown, (string | number)[]][] = [
				["a missing createdAt", [withoutCreatedAt], [0, "createdAt"]],
				["a non uuid id", [{ ...ACCOUNT, id: "42" }], [0, "id"]],
				[
					"a date only createdAt",
					[{ ...ACCOUNT, createdAt: "2026-10-03" }],
					[0, "createdAt"],
				],
				["a body that is not an array", { items: [] }, []],
			];

			for (const [label, data, path] of drifts) {
				it(`rejects ${label} with a response ValidationError`, async () => {
					// Arrange
					const { accounts, fake } = setup();
					fake.respondWith({ status: 200, data });

					// Act & Assert
					await expect(accounts.list()).rejects.toMatchObject({
						code: "VALIDATION_ERROR",
						direction: "response",
						operation: "accounts.list",
						message:
							"accounts.list failed: the API response did not match the expected shape",
						issues: [expect.objectContaining({ path })],
					});
				});
			}
		});

		// covers: AC-14
		it("passes the caller's signal through", async () => {
			// Arrange
			const { accounts, fake } = setup();
			const signal = new StubSignal(false);
			fake.respondWith({ status: 200, data: [] });

			// Act
			await accounts.list({ signal });

			// Assert
			expect(fake.requests[0]?.signal).toBe(signal);
		});

		// covers: AC-14
		it("sends no signal key when none is given", async () => {
			// Arrange
			const { accounts, fake } = setup();
			fake.respondWith({ status: 200, data: [] });

			// Act
			await accounts.list({});

			// Assert
			expect(fake.requests[0]).not.toHaveProperty("signal");
		});

		// covers: AC-14, AC-16
		it("rejects with an aborted NetworkError when the signal is aborted", async () => {
			// Arrange
			const { accounts } = setup();

			// Act & Assert
			await expect(
				accounts.list({ signal: new StubSignal(true) }),
			).rejects.toMatchObject({ code: "NETWORK_ERROR", aborted: true });
		});
	});

	describe("get", () => {
		// covers: AC-3
		it("sends GET /api/admin/accounts/{id} and resolves the parsed account", async () => {
			// Arrange
			const { accounts, fake } = setup();
			fake.respondWith({ status: 200, data: { ...ACCOUNT, extra: true } });

			// Act
			const result = await accounts.get(ID);

			// Assert
			expect(result).toEqual(ACCOUNT);
			expect(fake.requests[0]?.method).toBe("get");
			expect(fake.requests[0]?.url).toBe(`${ACCOUNTS}/${ID}`);
		});

		// covers: AC-13
		it('rejects a 404 with HttpError carrying "Account not found"', async () => {
			// Arrange
			const { accounts, fake } = setup();
			fake.respondWith({
				status: 404,
				statusText: "Not Found",
				data: "Account not found",
			});

			// Act & Assert
			await expect(accounts.get(ID)).rejects.toSatisfy(
				(error) =>
					error instanceof HttpError &&
					error.status === 404 &&
					error.code === "HTTP_ERROR" &&
					error.data === "Account not found",
			);
		});

		// covers: AC-10
		it("uses the read message for a bad response", async () => {
			// Arrange
			const { accounts, fake } = setup();
			fake.respondWith({ status: 200, data: { id: ID } });

			// Act & Assert
			await expect(accounts.get(ID)).rejects.toThrow(
				"accounts.get failed: the API response did not match the expected shape",
			);
		});

		// covers: AC-14
		it("passes the caller's signal through", async () => {
			// Arrange
			const { accounts, fake } = setup();
			const signal = new StubSignal(false);
			fake.respondWith({ status: 200, data: ACCOUNT });

			// Act
			await accounts.get(ID, { signal });

			// Assert
			expect(fake.requests[0]?.signal).toBe(signal);
		});
	});

	describe("create", () => {
		// covers: AC-4
		it("sends POST /api/admin/accounts with the trimmed body and resolves the parsed account", async () => {
			// Arrange
			const { accounts, fake } = setup();
			fake.respondWith({ status: 201, data: ACCOUNT });

			// Act
			const result = await accounts.create({
				name: "  Acme  ",
				logoUrl: INPUT.logoUrl,
			});

			// Assert
			expect(result).toEqual(ACCOUNT);
			expect(fake.requests[0]?.method).toBe("post");
			expect(fake.requests[0]?.url).toBe(ACCOUNTS);
			expect(JSON.parse(String(fake.requests[0]?.data))).toEqual(INPUT);
		});

		// covers: AC-9
		it("strips unknown input keys before sending", async () => {
			// Arrange
			const { accounts, fake } = setup();
			fake.respondWith({ status: 201, data: ACCOUNT });

			// Act
			await accounts.create({ ...INPUT, admin: true } as typeof INPUT);

			// Assert
			expect(JSON.parse(String(fake.requests[0]?.data))).toEqual(INPUT);
		});

		// covers: AC-13
		it("rejects a 400 with HttpError carrying the problem details", async () => {
			// Arrange
			const { accounts, fake } = setup();
			const problem = {
				title: "One or more validation errors occurred.",
				status: 400,
				errors: { Name: ["The Name field is required."] },
			};
			fake.respondWith({
				status: 400,
				statusText: "Bad Request",
				data: problem,
			});

			// Act & Assert
			await expect(accounts.create(INPUT)).rejects.toMatchObject({
				code: "HTTP_ERROR",
				status: 400,
				data: problem,
			});
		});

		// covers: AC-10
		it("uses the write message for a bad response", async () => {
			// Arrange
			const { accounts, fake } = setup();
			fake.respondWith({ status: 201, data: null });

			// Act & Assert
			await expect(accounts.create(INPUT)).rejects.toThrow(
				"accounts.create failed: the API response did not match the expected shape; the change may already have been applied",
			);
		});
	});

	describe("update", () => {
		// covers: AC-5
		it("sends PATCH /api/admin/accounts/{id} with the body and resolves the parsed account", async () => {
			// Arrange
			const { accounts, fake } = setup();
			fake.respondWith({ status: 200, data: ACCOUNT });

			// Act
			const result = await accounts.update(ID, INPUT);

			// Assert
			expect(result).toEqual(ACCOUNT);
			expect(fake.requests[0]?.method).toBe("patch");
			expect(fake.requests[0]?.url).toBe(`${ACCOUNTS}/${ID}`);
			expect(JSON.parse(String(fake.requests[0]?.data))).toEqual(INPUT);
		});

		// covers: AC-5
		it("resolves { success: true } when the API answers the no op", async () => {
			// Arrange
			const { accounts, fake } = setup();
			fake.respondWith({ status: 200, data: { success: true } });

			// Act
			const result = await accounts.update(ID, INPUT);

			// Assert
			expect(result).toEqual({ success: true });
		});

		// covers: AC-5, AC-10
		it("rejects { success: false } with a response ValidationError", async () => {
			// Arrange
			const { accounts, fake } = setup();
			fake.respondWith({ status: 200, data: { success: false } });

			// Act & Assert
			await expect(accounts.update(ID, INPUT)).rejects.toMatchObject({
				direction: "response",
				operation: "accounts.update",
			});
		});
	});

	describe("delete", () => {
		// covers: AC-6
		it("sends DELETE /api/admin/accounts/{id} and resolves { id }", async () => {
			// Arrange
			const { accounts, fake } = setup();
			fake.respondWith({ status: 200, data: { id: ID } });

			// Act
			const result = await accounts.delete(ID);

			// Assert
			expect(result).toEqual({ id: ID });
			expect(fake.requests[0]?.method).toBe("delete");
			expect(fake.requests[0]?.url).toBe(`${ACCOUNTS}/${ID}`);
		});

		// covers: AC-13
		it("rejects a 404 with HttpError", async () => {
			// Arrange
			const { accounts, fake } = setup();
			fake.respondWith({
				status: 404,
				statusText: "Not Found",
				data: "Account not found",
			});

			// Act & Assert
			await expect(accounts.delete(ID)).rejects.toMatchObject({
				code: "HTTP_ERROR",
				status: 404,
			});
		});

		// covers: AC-6, AC-10
		it("rejects a body without a uuid id with the write message", async () => {
			// Arrange
			const { accounts, fake } = setup();
			fake.respondWith({ status: 200, data: { Id: ID } });

			// Act & Assert
			await expect(accounts.delete(ID)).rejects.toMatchObject({
				direction: "response",
				message:
					"accounts.delete failed: the API response did not match the expected shape; the change may already have been applied",
			});
		});
	});

	describe("where the values come from", () => {
		// covers: AC-6
		it("resolves the id the API returns, not the id passed in", async () => {
			// Arrange
			const { accounts, fake } = setup();
			const returned = "11111111-2222-4333-8444-555555555555";
			fake.respondWith({ status: 200, data: { id: returned } });

			// Act
			const result = await accounts.delete(ID);

			// Assert
			expect(result).toEqual({ id: returned });
		});

		// covers: AC-6, AC-10
		it("rejects a delete answered with an empty 204 using the write message", async () => {
			// Arrange
			const { accounts, fake } = setup();
			fake.respondWith({ status: 204, data: "" });

			// Act & Assert
			await expect(accounts.delete(ID)).rejects.toMatchObject({
				direction: "response",
				operation: "accounts.delete",
				message:
					"accounts.delete failed: the API response did not match the expected shape; the change may already have been applied",
			});
		});

		// covers: AC-8
		it("puts an uppercase UUID in the path exactly as given", async () => {
			// Arrange
			const { accounts, fake } = setup();
			fake.respondWith({ status: 200, data: ACCOUNT });

			// Act
			await accounts.get(ID.toUpperCase());

			// Assert
			expect(fake.requests[0]?.url).toBe(`${ACCOUNTS}/${ID.toUpperCase()}`);
		});

		// covers: AC-5
		it("sends the update name trimmed", async () => {
			// Arrange
			const { accounts, fake } = setup();
			fake.respondWith({ status: 200, data: ACCOUNT });

			// Act
			await accounts.update(ID, { name: "  Acme  ", logoUrl: INPUT.logoUrl });

			// Assert
			expect(JSON.parse(String(fake.requests[0]?.data))).toEqual(INPUT);
		});

		// covers: AC-4
		it("accepts a plain http logoUrl", async () => {
			// Arrange
			const { accounts, fake } = setup();
			const input = { name: "Acme", logoUrl: "http://cdn.example.com/a.png" };
			fake.respondWith({ status: 201, data: ACCOUNT });

			// Act
			await accounts.create(input);

			// Assert
			expect(JSON.parse(String(fake.requests[0]?.data))).toEqual(input);
		});

		// covers: AC-9, AC-11
		it("points the request issue at the bad field and keeps the zod error as cause", async () => {
			// Arrange
			const { accounts } = setup();

			// Act
			const error = await accounts
				.create({ name: "Acme" } as typeof INPUT)
				.catch((e: unknown) => e);

			// Assert
			expect(error).toBeInstanceOf(ValidationError);
			const validation = error as ValidationError;
			expect(validation.issues.map((issue) => issue.path)).toEqual([
				["logoUrl"],
			]);
			expect(validation.cause).toBeInstanceOf(Error);
		});
	});

	// covers: AC-14
	describe("every write passes the caller's signal through", () => {
		const writes: [
			string,
			(a: AccountsApi, signal: StubSignal) => Promise<unknown>,
			unknown,
		][] = [
			["create", (a, signal) => a.create(INPUT, { signal }), ACCOUNT],
			["update", (a, signal) => a.update(ID, INPUT, { signal }), ACCOUNT],
			["delete", (a, signal) => a.delete(ID, { signal }), { id: ID }],
		];

		it.each(writes)("%s", async (_name, call, data) => {
			// Arrange
			const { accounts, fake } = setup();
			const signal = new StubSignal(false);
			fake.respondWith({ status: 200, data });

			// Act
			await call(accounts, signal);

			// Assert
			expect(fake.requests[0]?.signal).toBe(signal);
		});
	});

	// covers: AC-8, AC-9, AC-11
	describe("invalid request input is rejected before anything is sent", () => {
		const bad: [string, (a: AccountsApi) => Promise<unknown>, string][] = [
			["get('../users')", (a) => a.get("../users"), "accounts.get"],
			["get('')", (a) => a.get(""), "accounts.get"],
			["delete('abc')", (a) => a.delete("abc"), "accounts.delete"],
			[
				"update('abc', valid)",
				(a) => a.update("abc", INPUT),
				"accounts.update",
			],
			[
				"update(id, {})",
				(a) => a.update(ID, {} as typeof INPUT),
				"accounts.update",
			],
			[
				"create with a blank name",
				(a) => a.create({ name: "  ", logoUrl: INPUT.logoUrl }),
				"accounts.create",
			],
			[
				"create with a javascript: logoUrl",
				(a) => a.create({ name: "A", logoUrl: "javascript:alert(1)" }),
				"accounts.create",
			],
			[
				"create with logoUrl 'not a url'",
				(a) => a.create({ name: "A", logoUrl: "not a url" }),
				"accounts.create",
			],
			[
				"create without logoUrl",
				(a) => a.create({ name: "A" } as typeof INPUT),
				"accounts.create",
			],
			[
				"create with a numeric name",
				(a) => a.create({ ...INPUT, name: 7 } as unknown as typeof INPUT),
				"accounts.create",
			],
			[
				"create with a null name",
				(a) => a.create({ ...INPUT, name: null } as unknown as typeof INPUT),
				"accounts.create",
			],
			[
				"create with an ftp: logoUrl",
				(a) => a.create({ name: "A", logoUrl: "ftp://cdn.example.com/a.png" }),
				"accounts.create",
			],
			[
				"create with a data: logoUrl",
				(a) => a.create({ name: "A", logoUrl: "data:image/png;base64,AAAA" }),
				"accounts.create",
			],
			[
				"update with a blank name",
				(a) => a.update(ID, { name: "  ", logoUrl: INPUT.logoUrl }),
				"accounts.update",
			],
			[
				"update with a javascript: logoUrl",
				(a) => a.update(ID, { name: "A", logoUrl: "javascript:alert(1)" }),
				"accounts.update",
			],
		];

		for (const [label, call, operation] of bad) {
			it(label, async () => {
				// Arrange
				const { accounts, fake, providerCalls } = setup();

				// Act & Assert
				await expect(call(accounts)).rejects.toSatisfy(
					(error) =>
						error instanceof ValidationError &&
						error.direction === "request" &&
						error.operation === operation &&
						error.message === `${operation} failed: invalid request input` &&
						error.issues.length > 0,
				);
				expect(fake.requests).toHaveLength(0);
				expect(providerCalls()).toBe(0);
			});
		}
	});

	// covers: AC-13
	describe("API and transport failures keep the spec 0004 errors", () => {
		for (const [status, statusText] of [
			[401, "Unauthorized"],
			[403, "Forbidden"],
			[500, "Internal Server Error"],
		] as const) {
			it(`rejects a ${status} with HttpError`, async () => {
				// Arrange
				const { accounts, fake } = setup();
				fake.respondWith({ status, statusText, data: null });

				// Act & Assert
				await expect(accounts.list()).rejects.toMatchObject({
					code: "HTTP_ERROR",
					status,
				});
			});
		}

		it("rejects no response with NetworkError", async () => {
			// Arrange
			const { accounts, fake } = setup();
			fake.failWith(
				(config) => new AxiosError("socket hang up", "ECONNRESET", config, {}),
			);

			// Act & Assert
			await expect(accounts.list()).rejects.toSatisfy(
				(error) => error instanceof NetworkError && !error.aborted,
			);
		});

		it("rejects a failing provider with AuthTokenError", async () => {
			// Arrange
			const { accounts, http, fake } = setup();
			http.setAuthTokenProvider(async () => {
				throw new Error("login required");
			});

			// Act & Assert
			await expect(accounts.get(ID)).rejects.toBeInstanceOf(AuthTokenError);
			expect(fake.requests).toHaveLength(0);
		});
	});
});
