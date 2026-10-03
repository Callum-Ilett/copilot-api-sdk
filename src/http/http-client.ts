import axios, {
	type AxiosInstance,
	type AxiosRequestConfig,
	type AxiosResponse,
} from "axios";
import { AuthTokenError } from "@/errors/auth-token-error";
import { HttpError } from "@/errors/http-error";
import { NetworkError } from "@/errors/network-error";
import type {
	AuthTokenProvider,
	HttpClientOptions,
	HttpMethod,
	RequestOptions,
} from "@/http/types";

/** Matches a scheme (`https:`, `mailto:`) or a protocol relative `//` prefix. */
const ABSOLUTE_URL = /^([a-z][a-z\d+\-.]*:|\/\/)/i;

/**
 * Sends authenticated requests to paths under one base URL.
 *
 * Internal to the SDK. Every method resolves to the parsed response body as
 * `unknown`, or rejects with a `TypeError` (absolute path), `AuthTokenError`,
 * `NetworkError`, or `HttpError`. An axios error never escapes; it may sit in
 * `cause`.
 *
 * @example
 * ```ts
 * const client = new HttpClient("https://api.example.com/v1");
 * client.setAuthTokenProvider(() => auth.getAccessToken());
 * const chats = await client.get("/chats");
 * ```
 */
export class HttpClient {
	readonly #baseURL: string;
	readonly #axios: AxiosInstance;
	#tokenProvider: AuthTokenProvider | undefined;

	/**
	 * @param baseURL - Every path is appended to this. Not validated.
	 * @param options - An optional axios `adapter`, for tests.
	 */
	constructor(baseURL: string, options: HttpClientOptions = {}) {
		this.#baseURL = baseURL;

		this.#axios = axios.create({
			validateStatus: null,
			...(options.adapter ? { adapter: options.adapter } : {}),
		});
	}

	/**
	 * Sets where bearer tokens come from. Affects only requests started after
	 * this call.
	 *
	 * @param provider - Called once per request; must resolve to a non empty string.
	 */
	setAuthTokenProvider(provider: AuthTokenProvider): void {
		this.#tokenProvider = provider;
	}

	/**
	 * Sends a `GET` request.
	 *
	 * @param path - Appended to the base URL; must not be absolute.
	 * @param options - Query params, extra headers, and a cancel signal.
	 * @returns The parsed response body.
	 */
	get(path: string, options?: RequestOptions): Promise<unknown> {
		return this.#send("GET", path, undefined, options);
	}

	/**
	 * Sends a `DELETE` request.
	 *
	 * @param path - Appended to the base URL; must not be absolute.
	 * @param options - Query params, extra headers, and a cancel signal.
	 * @returns The parsed response body.
	 */
	delete(path: string, options?: RequestOptions): Promise<unknown> {
		return this.#send("DELETE", path, undefined, options);
	}

	/**
	 * Sends a `POST` request.
	 *
	 * @param path - Appended to the base URL; must not be absolute.
	 * @param body - The request body; plain objects are sent as JSON.
	 * @param options - Query params, extra headers, and a cancel signal.
	 * @returns The parsed response body.
	 */
	post(
		path: string,
		body?: unknown,
		options?: RequestOptions,
	): Promise<unknown> {
		return this.#send("POST", path, body, options);
	}

	/**
	 * Sends a `PUT` request.
	 *
	 * @param path - Appended to the base URL; must not be absolute.
	 * @param body - The request body; plain objects are sent as JSON.
	 * @param options - Query params, extra headers, and a cancel signal.
	 * @returns The parsed response body.
	 */
	put(
		path: string,
		body?: unknown,
		options?: RequestOptions,
	): Promise<unknown> {
		return this.#send("PUT", path, body, options);
	}

	/**
	 * Sends a `PATCH` request.
	 *
	 * @param path - Appended to the base URL; must not be absolute.
	 * @param body - The request body; plain objects are sent as JSON.
	 * @param options - Query params, extra headers, and a cancel signal.
	 * @returns The parsed response body.
	 */
	patch(
		path: string,
		body?: unknown,
		options?: RequestOptions,
	): Promise<unknown> {
		return this.#send("PATCH", path, body, options);
	}

	async #send(
		method: HttpMethod,
		path: string,
		body: unknown,
		options: RequestOptions = {},
	): Promise<unknown> {
		if (ABSOLUTE_URL.test(path)) {
			throw new TypeError(
				`Refusing absolute URL path; pass a path relative to the base URL`,
			);
		}

		// Remove duplicate slashes when joining the base URL and path.
		const url = `${this.#baseURL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

		// Captured before any await, so a later setAuthTokenProvider call
		// never changes a request already in flight.
		const provider = this.#tokenProvider;

		const token = provider
			? await this.#fetchToken(provider, method, url)
			: undefined;

		const config: AxiosRequestConfig = { method, url };

		if (body !== undefined) config.data = body;
		if (options.params) config.params = options.params;
		if (options.signal) config.signal = options.signal;

		const headers = this.#buildHeaders(options.headers, token);
		if (headers) config.headers = headers;

		let response: AxiosResponse<unknown>;
		try {
			response = await this.#axios.request<unknown>(config);
		} catch (error) {
			throw new NetworkError({
				method,
				url,
				aborted: axios.isCancel(error),
				cause: error,
			});
		}

		if (response.status < 200 || response.status > 299) {
			throw new HttpError({
				status: response.status,
				statusText: response.statusText,
				method,
				url,
				data: response.data,
			});
		}

		return response.data;
	}

	async #fetchToken(
		provider: AuthTokenProvider,
		method: HttpMethod,
		url: string,
	): Promise<string> {
		let token: string;

		try {
			token = await provider();
		} catch (error) {
			throw new AuthTokenError({ method, url, cause: error });
		}

		// Plain JS providers can resolve to undefined or null despite the type.
		if (typeof token !== "string" || token === "") {
			throw new AuthTokenError({ method, url });
		}

		return token;
	}

	#buildHeaders(
		callerHeaders: Record<string, string> | undefined,
		token: string | undefined,
	): Record<string, string> | undefined {
		if (token === undefined) return callerHeaders;
		const headers: Record<string, string> = {};

		for (const [name, value] of Object.entries(callerHeaders ?? {})) {
			// The provider token wins over a caller Authorization, in any casing.
			if (name.toLowerCase() !== "authorization") headers[name] = value;
		}

		headers.Authorization = `Bearer ${token}`;
		return headers;
	}
}
