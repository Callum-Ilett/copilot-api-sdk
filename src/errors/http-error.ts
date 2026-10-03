import { CopilotApiError } from "@/errors/copilot-api-error";
import type { HttpMethod } from "@/http/types";

/**
 * The API answered with a status outside 200 to 299.
 *
 * A 401 lands here too; the client does not retry it.
 */
export class HttpError extends CopilotApiError {
	override readonly name: string = "HttpError";
	/** The response status code. */
	readonly status: number;
	/** The response status text. */
	readonly statusText: string;
	/** The method of the failed request. */
	readonly method: HttpMethod;
	/** The full URL of the failed request. */
	readonly url: string;
	/** The error body as axios parsed it. May hold anything the API returned. */
	readonly data: unknown;

	/**
	 * @param details - The failed request and the response it got.
	 */
	constructor(details: {
		status: number;
		statusText: string;
		method: HttpMethod;
		url: string;
		data: unknown;
	}) {
		super(
			`${details.method} ${details.url} failed: ${details.status} ${details.statusText}`.trimEnd(),
		);
		this.status = details.status;
		this.statusText = details.statusText;
		this.method = details.method;
		this.url = details.url;
		this.data = details.data;
	}
}
