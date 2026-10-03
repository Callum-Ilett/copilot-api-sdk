import { CopilotApiError } from "@/errors/copilot-api-error";
import type { HttpMethod } from "@/http/types";

/**
 * The token provider rejected, threw, or resolved to something other than a
 * non empty string, so the request was never sent. `cause` holds the
 * provider's error, or is `undefined` for an empty or missing token.
 */
export class AuthTokenError extends CopilotApiError {
	override readonly name: string = "AuthTokenError";
	/** The method of the request that needed the token. */
	readonly method: HttpMethod;
	/** The full URL of the request that needed the token. */
	readonly url: string;

	/**
	 * @param details - The request that needed the token, and the provider's error if it failed.
	 */
	constructor(details: { method: HttpMethod; url: string; cause?: unknown }) {
		const reason =
			"cause" in details
				? "auth token provider failed"
				: "auth token provider returned an empty token";
		super(
			`${details.method} ${details.url} failed: ${reason}`,
			"cause" in details ? { cause: details.cause } : undefined,
		);
		this.method = details.method;
		this.url = details.url;
	}
}
