/**
 * Base class for every error the SDK raises when calling the Copilot API.
 *
 * Never thrown directly; catch it to handle any SDK failure, or catch a
 * subclass (`HttpError`, `NetworkError`, `AuthTokenError`) to tell them apart.
 * Messages never include the bearer token.
 */
export abstract class CopilotApiError extends Error {
	/**
	 * @param message - What failed, in the form `"<METHOD> <url> failed: <reason>"`.
	 * @param options - The underlying error, if any, kept as `cause`.
	 */
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
	}
}
