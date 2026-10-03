import { AxiosError, CanceledError, type GenericAbortSignal } from "axios";
import { describe, expect, it } from "vitest";
import { AuthTokenError } from "@/errors/auth-token-error";
import { CopilotApiError } from "@/errors/copilot-api-error";
import { HttpError } from "@/errors/http-error";
import { NetworkError } from "@/errors/network-error";
import { HttpClient } from "@/http/http-client";
import { FakeAdapter } from "./fake-adapter";

const BASE = "https://api.example.com/v1";
const CHATS = `${BASE}/chats`;

function setup(base: string = BASE): { client: HttpClient; fake: FakeAdapter } {
	const fake = new FakeAdapter();
	const client = new HttpClient(base, { adapter: fake.adapter });
	return { client, fake };
}

function countingProvider(token: string): {
	provider: () => Promise<string>;
	calls: () => number;
} {
	let count = 0;
	return {
		provider: async () => {
			count += 1;
			return token;
		},
		calls: () => count,
	};
}

// A class instance, like a real AbortSignal: axios clones plain objects in
// its config but passes class instances through as is.
class FakeSignal implements GenericAbortSignal {
	readonly aborted = false;
	onabort = null;
	addEventListener(): void {}
	removeEventListener(): void {}
}
const fakeSignal = new FakeSignal();

describe("HttpClient", () => {
	// covers: AC-1, AC-3
	describe("methods and URLs", () => {
		const calls: [string, (c: HttpClient, path: string) => Promise<unknown>][] =
			[
				["get", (c, p) => c.get(p)],
				["delete", (c, p) => c.delete(p)],
				["post", (c, p) => c.post(p)],
				["put", (c, p) => c.put(p)],
				["patch", (c, p) => c.patch(p)],
			];

		for (const [method, call] of calls) {
			for (const path of ["/chats", "chats"]) {
				it(`${method} ${path} goes to ${CHATS} and resolves to the body`, async () => {
					// Arrange
					const { client, fake } = setup();
					fake.respondWith({ status: 200, data: { ok: method } });

					// Act
					const result = await call(client, path);

					// Assert
					expect(result).toEqual({ ok: method });
					expect(fake.requests).toHaveLength(1);
					expect(fake.requests[0]?.method).toBe(method);
					expect(fake.requests[0]?.url).toBe(CHATS);
				});
			}
		}

		it("collapses repeated slashes at the join (a `//` path is refused, AC-9)", async () => {
			// Arrange
			const { client, fake } = setup(`${BASE}//`);

			// Act
			await client.get("/chats");

			// Assert
			expect(fake.requests[0]?.url).toBe(CHATS);
		});

		it("resolves any 2xx body as parsed, including an empty one", async () => {
			// Arrange
			const { client, fake } = setup();
			fake.respondWith({ status: 204, data: "" });

			// Act
			const result = await client.delete("/chats/1");

			// Assert
			expect(result).toBe("");
		});

		it("keeps a nested path intact under a base without a trailing slash", async () => {
			// Arrange
			const { client, fake } = setup();

			// Act
			await client.get("chats/1/messages");

			// Assert
			expect(fake.requests[0]?.url).toBe(`${BASE}/chats/1/messages`);
		});
	});

	// covers: AC-3, AC-7
	describe("status boundaries", () => {
		for (const status of [200, 299]) {
			it(`a ${status} resolves to the body`, async () => {
				// Arrange
				const { client, fake } = setup();
				fake.respondWith({ status, data: { a: 1 } });

				// Act
				const result = await client.get("/chats");

				// Assert
				expect(result).toEqual({ a: 1 });
			});
		}

		for (const status of [199, 300]) {
			it(`a ${status} rejects with HttpError`, async () => {
				// Arrange
				const { client, fake } = setup();
				fake.respondWith({ status, data: null });

				// Act & Assert
				await expect(client.get("/chats")).rejects.toMatchObject({
					name: "HttpError",
					status,
				});
			});
		}
	});

	// covers: AC-2
	describe("inputs", () => {
		for (const method of ["post", "put", "patch"] as const) {
			it(`${method} sends body as data`, async () => {
				// Arrange
				const { client, fake } = setup();

				// Act
				await client[method]("/chats", { title: "hi" });

				// Assert
				expect(JSON.parse(String(fake.requests[0]?.data))).toEqual({
					title: "hi",
				});
			});
		}

		it("get and delete send no body", async () => {
			// Arrange
			const { client, fake } = setup();

			// Act
			await client.get("/chats");
			await client.delete("/chats/1");

			// Assert
			expect(fake.requests[0]?.data).toBeUndefined();
			expect(fake.requests[1]?.data).toBeUndefined();
		});

		it("passes params, headers, and signal through", async () => {
			// Arrange
			const { client, fake } = setup();

			// Act
			await client.post(
				"/chats",
				{ a: 1 },
				{
					params: { page: 2, q: "x", all: true },
					headers: { "X-Trace": "abc" },
					signal: fakeSignal,
				},
			);

			// Assert
			const sent = fake.requests[0];
			expect(sent?.params).toEqual({ page: 2, q: "x", all: true });
			expect(sent?.headers.get("X-Trace")).toBe("abc");
			expect(sent?.signal).toBe(fakeSignal);
		});

		it("passes params on a get too", async () => {
			// Arrange
			const { client, fake } = setup();

			// Act
			await client.get("/chats", { params: { page: 2, all: true } });

			// Assert
			expect(fake.requests[0]?.params).toEqual({ page: 2, all: true });
		});
	});

	// covers: AC-4, AC-5
	describe("auth", () => {
		it("adds the bearer token, once per request", async () => {
			// Arrange
			const { client, fake } = setup();
			const { provider, calls } = countingProvider("t1");
			client.setAuthTokenProvider(provider);

			// Act
			await client.get("/chats");
			await client.post("/chats", {});

			// Assert
			expect(calls()).toBe(2);
			for (const sent of fake.requests) {
				expect(sent.headers.get("Authorization")).toBe("Bearer t1");
			}
		});

		it("replaces a caller Authorization header, in any casing", async () => {
			// Arrange
			const { client, fake } = setup();
			client.setAuthTokenProvider(async () => "t1");

			// Act
			await client.get("/chats", { headers: { authorization: "Basic x" } });
			await client.get("/chats", { headers: { Authorization: "Basic x" } });

			// Assert
			for (const sent of fake.requests) {
				expect(sent.headers.get("Authorization")).toBe("Bearer t1");
			}
		});

		it("uses a replaced provider for later requests", async () => {
			// Arrange
			const { client, fake } = setup();
			client.setAuthTokenProvider(async () => "t1");

			// Act
			await client.get("/chats");
			client.setAuthTokenProvider(async () => "t2");
			await client.get("/chats");

			// Assert
			expect(fake.requests[0]?.headers.get("Authorization")).toBe("Bearer t1");
			expect(fake.requests[1]?.headers.get("Authorization")).toBe("Bearer t2");
		});

		it("keeps the provider a request started with", async () => {
			// Arrange
			const { client, fake } = setup();
			client.setAuthTokenProvider(async () => "t1");

			// Act
			const pending = client.get("/chats");
			client.setAuthTokenProvider(async () => "t2");
			await pending;

			// Assert
			expect(fake.requests[0]?.headers.get("Authorization")).toBe("Bearer t1");
		});

		it("adds no Authorization header without a provider", async () => {
			// Arrange
			const { client, fake } = setup();

			// Act
			await client.get("/chats");
			await client.get("/chats", { headers: { Authorization: "Basic x" } });

			// Assert
			expect(fake.requests[0]?.headers.has("Authorization")).toBe(false);
			expect(fake.requests[1]?.headers.get("Authorization")).toBe("Basic x");
		});
	});

	// covers: AC-6
	describe("token failure", () => {
		const boom = new Error("boom");
		const cases: [string, () => Promise<string>, unknown][] = [
			["a rejecting provider", () => Promise.reject(boom), boom],
			[
				"a throwing provider",
				() => {
					throw boom;
				},
				boom,
			],
			["an empty token", async () => "", undefined],
			// Plain JS callers can bypass the Promise<string> type.
			[
				"an undefined token",
				async () => undefined as unknown as string,
				undefined,
			],
			["a null token", async () => null as unknown as string, undefined],
		];

		for (const [label, provider, cause] of cases) {
			it(`${label} rejects with AuthTokenError and sends nothing`, async () => {
				// Arrange
				const { client, fake } = setup();
				client.setAuthTokenProvider(provider);

				// Act
				const error = await client.get("/chats").catch((e: unknown) => e);

				// Assert
				expect(error).toBeInstanceOf(AuthTokenError);
				expect(error).toBeInstanceOf(CopilotApiError);
				expect(error).toMatchObject({
					name: "AuthTokenError",
					method: "GET",
					url: CHATS,
				});
				expect((error as Error).cause).toBe(cause);
				expect(fake.requests).toHaveLength(0);
			});
		}

		it("a provider rejecting with undefined still reads as a provider failure", async () => {
			// Arrange
			const { client } = setup();
			client.setAuthTokenProvider(() => Promise.reject(undefined));

			// Act
			const error = await client.get("/chats").catch((e: unknown) => e);

			// Assert
			expect(error).toBeInstanceOf(AuthTokenError);
			expect((error as Error).message).toBe(
				`GET ${CHATS} failed: auth token provider failed`,
			);
		});
	});

	// covers: AC-7
	describe("HTTP failure", () => {
		for (const [status, statusText] of [
			[404, "Not Found"],
			[401, "Unauthorized"],
		] as const) {
			it(`a ${status} rejects with HttpError and calls the provider once`, async () => {
				// Arrange
				const { client, fake } = setup();
				const { provider, calls } = countingProvider("secret-token");
				client.setAuthTokenProvider(provider);
				fake.respondWith({ status, statusText, data: { error: "nope" } });

				// Act
				const error = await client.put("/chats", {}).catch((e: unknown) => e);

				// Assert
				expect(error).toBeInstanceOf(HttpError);
				expect(error).toBeInstanceOf(CopilotApiError);
				expect(error).toMatchObject({
					name: "HttpError",
					status,
					statusText,
					method: "PUT",
					url: CHATS,
					data: { error: "nope" },
				});
				expect((error as Error).message).not.toContain("secret-token");
				expect(calls()).toBe(1);
				expect(fake.requests).toHaveLength(1);
			});
		}

		it("copies an unusual status, status text, and body onto the error", async () => {
			// Arrange
			const { client, fake } = setup();
			fake.respondWith({
				status: 418,
				statusText: "I'm a teapot",
				data: { e: 1 },
			});

			// Act
			const error = await client.post("/chats", {}).catch((e: unknown) => e);

			// Assert
			expect(error).toMatchObject({
				status: 418,
				statusText: "I'm a teapot",
				data: { e: 1 },
			});
			expect((error as Error).message).toBe(
				`POST ${CHATS} failed: 418 I'm a teapot`,
			);
		});
	});

	// covers: AC-8
	describe("network failure", () => {
		it("a network error rejects with NetworkError, not aborted", async () => {
			// Arrange
			const { client, fake } = setup();
			let thrown: unknown;
			fake.failWith((config) => {
				thrown = new AxiosError("Network Error", "ERR_NETWORK", config);
				return thrown;
			});

			// Act
			const error = await client.patch("/chats", {}).catch((e: unknown) => e);

			// Assert
			expect(error).toBeInstanceOf(NetworkError);
			expect(error).toBeInstanceOf(CopilotApiError);
			expect(error).toMatchObject({
				name: "NetworkError",
				method: "PATCH",
				url: CHATS,
				aborted: false,
			});
			expect((error as Error).cause).toBe(thrown);
		});

		it("a cancellation rejects with NetworkError, aborted", async () => {
			// Arrange
			const { client, fake } = setup();
			fake.failWith(
				(config) => new CanceledError(undefined, undefined, config),
			);

			// Act
			const error = await client.get("/chats").catch((e: unknown) => e);

			// Assert
			expect(error).toBeInstanceOf(NetworkError);
			expect(error).toMatchObject({ aborted: true });
			expect((error as Error).cause).toBeInstanceOf(CanceledError);
		});

		it("wraps a non axios transport error too, so nothing raw escapes", async () => {
			// Arrange
			const { client, fake } = setup();
			const raw = new Error("adapter blew up");
			fake.failWith(() => raw);

			// Act
			const error = await client.get("/chats").catch((e: unknown) => e);

			// Assert
			expect(error).toBeInstanceOf(NetworkError);
			expect(error).toMatchObject({ aborted: false });
			expect((error as Error).cause).toBe(raw);
		});

		it("keeps the token out of the message", async () => {
			// Arrange
			const { client, fake } = setup();
			client.setAuthTokenProvider(async () => "secret-token");
			fake.failWith(
				(config) => new AxiosError("Network Error", "ERR_NETWORK", config),
			);

			// Act
			const error = await client.get("/chats").catch((e: unknown) => e);

			// Assert
			expect((error as Error).message).toBe(
				`GET ${CHATS} failed: no response received`,
			);
		});
	});

	// covers: AC-9
	describe("absolute paths", () => {
		for (const path of [
			"https://evil.example/x",
			"//evil.example/x",
			"HTTP://evil.example/x",
			"mailto:x",
			"a+b.c:x",
			// Looks like a scheme, so it is refused; callers avoid a colon in the first segment.
			"chats:archive",
		]) {
			it(`refuses ${path} before fetching a token`, async () => {
				// Arrange
				const { client, fake } = setup();
				const { provider, calls } = countingProvider("t1");
				client.setAuthTokenProvider(provider);

				// Act & Assert
				await expect(client.get(path)).rejects.toBeInstanceOf(TypeError);
				expect(calls()).toBe(0);
				expect(fake.requests).toHaveLength(0);
			});
		}

		for (const path of ["chats/a:b", "/chats/1:archive"]) {
			it(`allows ${path}, a colon after the first segment`, async () => {
				// Arrange
				const { client, fake } = setup();

				// Act
				await client.get(path);

				// Assert
				expect(fake.requests[0]?.url).toBe(
					`${BASE}/${path.replace(/^\//, "")}`,
				);
			});
		}
	});
});
