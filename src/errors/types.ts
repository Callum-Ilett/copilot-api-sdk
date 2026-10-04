/**
 * The fixed `code` of every SDK error class, one per class.
 *
 * Match on it instead of `instanceof` when an error may come from another
 * copy of the SDK (the ESM and CommonJS builds can load side by side).
 */
export type CopilotApiErrorCode =
	| "HTTP_ERROR"
	| "NETWORK_ERROR"
	| "AUTH_TOKEN_ERROR"
	| "VALIDATION_ERROR";

/**
 * One problem found while checking data against a schema.
 */
export type ValidationIssue = {
	/** Where the problem is, as keys from the root of the checked value. Empty for the value itself. */
	readonly path: readonly PropertyKey[];
	/** What is wrong, in words. */
	readonly message: string;
	/** A short machine readable kind, such as `"invalid_type"` or `"invalid_format"`. */
	readonly code: string;
};
