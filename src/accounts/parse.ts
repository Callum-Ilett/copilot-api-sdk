import type { z } from "zod";
import type { ValidationIssue } from "@/errors/types";
import { ValidationError } from "@/errors/validation-error";

/**
 * Where a parse happens: which side of the call, which SDK method, and
 * whether that method writes (it changes the `ValidationError` message).
 */
export type ParseContext = {
	direction: "request" | "response";
	operation: string;
	mutating: boolean;
};

/**
 * Parses `value` with `schema`, or throws a `ValidationError` built from
 * `context` and the schema's issues.
 *
 * @param schema - The schema to check against.
 * @param value - The untrusted value.
 * @param context - Which check this is, used for the error.
 * @returns The parsed value.
 */
export function parseWith<S extends z.ZodType>(
	schema: S,
	value: unknown,
	context: ParseContext,
): z.output<S> {
	const result = schema.safeParse(value);
	if (result.success) return result.data;

	const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
		path: issue.path,
		message: issue.message,
		code: issue.code,
	}));

	throw new ValidationError({ ...context, issues, cause: result.error });
}
