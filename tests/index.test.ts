import { describe, expect, it } from "vitest";
import * as sdk from "@/index";

describe("package entry", () => {
	// covers: AC-15
	it("exports exactly the public values, and no schema or internal class", () => {
		// Act
		const names = Object.keys(sdk).sort();

		// Assert
		expect(names).toEqual([
			"AuthTokenError",
			"CopilotAdminClient",
			"CopilotApiError",
			"HttpError",
			"NetworkError",
			"ValidationError",
		]);
	});

	// covers: AC-12
	it("gives every exported error class the CopilotApiError base", () => {
		// Arrange
		const classes = [
			sdk.HttpError,
			sdk.NetworkError,
			sdk.AuthTokenError,
			sdk.ValidationError,
		];

		// Act
		const extendsBase = classes.map(
			(cls) => cls.prototype instanceof sdk.CopilotApiError,
		);

		// Assert
		expect(extendsBase).toEqual([true, true, true, true]);
	});
});
