import type { AxiosAdapter, GenericAbortSignal } from "axios";

/**
 * An HTTP method `HttpClient` can send.
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Supplies a JWT access token for one request.
 *
 * Called once per request, right before it is sent. Any auth source works
 * (MSAL, Auth0, a custom one), as long as it resolves to a non empty token.
 *
 * @returns The bearer token to send in the `Authorization` header.
 */
export type AuthTokenProvider = () => Promise<string>;

/**
 * Per request options, passed to axios unchanged.
 */
export type RequestOptions = {
	/** Query string values, encoded by axios. */
	params?: Record<string, string | number | boolean>;
	/** Extra request headers. A provider token replaces any `Authorization` given here. */
	headers?: Record<string, string>;
	/**
	 * Cancels the request when aborted. A real `AbortSignal` satisfies this;
	 * the axios type is used because the project `lib` has no DOM or Node types.
	 */
	signal?: GenericAbortSignal;
};

/**
 * Options for constructing an `HttpClient`.
 */
export type HttpClientOptions = {
	/** Replaces the axios transport, so tests can inject a fake adapter. */
	adapter?: AxiosAdapter;
};
