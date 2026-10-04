import { describe, expect, it } from "vitest";
import { CopilotApiError } from "@/errors/copilot-api-error";
import { ValidationError } from "@/errors/validation-error";

const ISSUES = [{ path: ["name"], message: "Too small", code: "too_small" }];

describe("ValidationError", () => {
	// covers: AC-11, AC-12
	it("keeps direction, operation, issues, cause, and its fixed code", () => {
		// Arrange
		const cause = new Error("zod");

		// Act
		const error = new ValidationError({
			direction: "request",
			operation: "accounts.create",
			mutating: true,
			issues: ISSUES,
			cause,
		});

		// Assert
		expect(error).toMatchObject({
			name: "ValidationError",
			direction: "request",
			operation: "accounts.create",
			issues: ISSUES,
		});
		expect(error.code).toBe("VALIDATION_ERROR");
		expect(error.cause).toBe(cause);
		expect(error).toBeInstanceOf(CopilotApiError);
		expect(error).toBeInstanceOf(Error);
	});

	// covers: AC-10
	describe("message templates", () => {
		const cases: ["request" | "response", boolean, string, string][] = [
			[
				"request",
				true,
				"accounts.create",
				"accounts.create failed: invalid request input",
			],
			[
				"request",
				false,
				"accounts.get",
				"accounts.get failed: invalid request input",
			],
			[
				"response",
				false,
				"accounts.get",
				"accounts.get failed: the API response did not match the expected shape",
			],
			[
				"response",
				true,
				"accounts.create",
				"accounts.create failed: the API response did not match the expected shape; the change may already have been applied",
			],
		];

		for (const [direction, mutating, operation, message] of cases) {
			it(`${direction}, ${mutating ? "write" : "read"}: "${message}"`, () => {
				// Act
				const error = new ValidationError({
					direction,
					operation,
					mutating,
					issues: [],
					cause: undefined,
				});

				// Assert
				expect(error.message).toBe(message);
			});
		}
	});
});
