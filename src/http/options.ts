// Kept apart from types.ts so the public types there never pull axios into
// the built declarations.
import type { AxiosAdapter, GenericAbortSignal } from "axios";

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
