import type { CopilotApiErrorCode } from "@/errors/types";

/**
 * Base class for every error the SDK raises when calling the Copilot API.
 *
 * Never thrown directly; catch it to handle any SDK failure, or catch a
 * subclass (`HttpError`, `NetworkError`, `AuthTokenError`, `ValidationError`)
 * to tell them apart, or match on `code`. Messages never include the bearer
 * token.
 */
export abstract class CopilotApiError extends Error {
	/** A fixed string per error class; see `CopilotApiErrorCode`. */
	abstract readonly code: CopilotApiErrorCode;
}
