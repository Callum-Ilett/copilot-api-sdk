/**
 * The fixed `code` of every SDK error class, one per class.
 *
 * Match on it instead of `instanceof` when an error may come from another
 * copy of the SDK (the ESM and CommonJS builds can load side by side).
 */
export type CopilotApiErrorCode =
	| "HTTP_ERROR"
	| "NETWORK_ERROR"
	| "AUTH_TOKEN_ERROR";
