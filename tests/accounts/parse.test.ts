import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseWith } from "@/accounts/parse";
import { ValidationError } from "@/errors/validation-error";

const Schema = z.object({ name: z.string().trim().min(1) });
const CONTEXT = {
	direction: "response",
	operation: "accounts.get",
	mutating: false,
} as const;

describe("parseWith", () => {
	it("returns the parsed value, transforms applied and unknown keys stripped", () => {
		// Act
		const result = parseWith(Schema, { name: "  Acme ", extra: 1 }, CONTEXT);

		// Assert
		expect(result).toEqual({ name: "Acme" });
	});

	// covers: AC-10, AC-11
	it("throws a ValidationError carrying the context, mapped issues, and the zod error", () => {
		// Act
		let thrown: unknown;
		try {
			parseWith(Schema, { name: 5 }, CONTEXT);
		} catch (error) {
			thrown = error;
		}

		// Assert
		expect(thrown).toBeInstanceOf(ValidationError);
		const error = thrown as ValidationError;
		expect(error.direction).toBe("response");
		expect(error.operation).toBe("accounts.get");
		expect(error.message).toBe(
			"accounts.get failed: the API response did not match the expected shape",
		);
		expect(error.issues).toEqual([
			{ path: ["name"], message: expect.any(String), code: "invalid_type" },
		]);
		expect(error.cause).toBeInstanceOf(z.ZodError);
	});

	// covers: AC-11
	it("maps issues to exactly path, message, and code", () => {
		// Act & Assert
		expect(() => parseWith(Schema, {}, CONTEXT)).toThrow(
			expect.objectContaining({
				issues: [
					{
						path: ["name"],
						message: expect.any(String),
						code: "invalid_type",
					},
				],
			}),
		);
	});
});
