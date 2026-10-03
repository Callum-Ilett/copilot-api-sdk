import { CopilotApiError } from "@/errors/copilot-api-error";
import type { HttpMethod } from "@/http/types";

/**
 * No response arrived, for any reason: a network or DNS failure, a
 * cancellation through `options.signal`, or a request axios could not build
 * or send (for example a body that cannot be serialised). The original error
 * is kept as `cause`; check it before retrying.
 */
export class NetworkError extends CopilotApiError {
	override readonly name: string = "NetworkError";
	/** The method of the failed request. */
	readonly method: HttpMethod;
	/** The full URL of the failed request. */
	readonly url: string;
	/** `true` only when the request was cancelled. */
	readonly aborted: boolean;

	/**
	 * @param details - The failed request, whether it was cancelled, and the axios error.
	 */
	constructor(details: {
		method: HttpMethod;
		url: string;
		aborted: boolean;
		cause: unknown;
	}) {
		const reason = details.aborted ? "request aborted" : "no response received";
		super(`${details.method} ${details.url} failed: ${reason}`, {
			cause: details.cause,
		});
		this.method = details.method;
		this.url = details.url;
		this.aborted = details.aborted;
	}
}
