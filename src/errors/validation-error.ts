import { CopilotApiError } from "@/errors/copilot-api-error";
import type { ValidationIssue } from "@/errors/types";

/**
 * Data did not match its schema, so the call stopped.
 *
 * `direction: "request"` means your input was rejected before anything was
 * sent (the token provider was not called either). `direction: "response"`
 * means the API answered 2xx with a body the SDK did not expect; after a
 * write (`create`, `update`, `delete`) the change may already have been
 * applied, so refetch before retrying.
 */
export class ValidationError extends CopilotApiError {
	override readonly name: string = "ValidationError";
	override readonly code: "VALIDATION_ERROR" = "VALIDATION_ERROR";
	/** Whether the caller's input or the API's response failed the check. */
	readonly direction: "request" | "response";
	/** The SDK method that failed, such as `"accounts.get"`. */
	readonly operation: string;
	/** Every problem the schema found. */
	readonly issues: readonly ValidationIssue[];

	/**
	 * @param details - Which check failed, for which method, whether that method writes, what was wrong, and the schema library's error as `cause`.
	 */
	constructor(details: {
		direction: "request" | "response";
		operation: string;
		mutating: boolean;
		issues: readonly ValidationIssue[];
		cause: unknown;
	}) {
		super(`${details.operation} failed: ${reason(details)}`, {
			cause: details.cause,
		});
		this.direction = details.direction;
		this.operation = details.operation;
		this.issues = details.issues;
	}
}

function reason(details: {
	direction: "request" | "response";
	mutating: boolean;
}): string {
	if (details.direction === "request") return "invalid request input";
	const mismatch = "the API response did not match the expected shape";
	return details.mutating
		? `${mismatch}; the change may already have been applied`
		: mismatch;
}
