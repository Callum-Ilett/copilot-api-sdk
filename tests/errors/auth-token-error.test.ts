import { describe, expect, it } from "vitest";
import { AuthTokenError } from "@/errors/auth-token-error";
import { CopilotApiError } from "@/errors/copilot-api-error";

const URL = "https://api.example.com/v1/chats";

describe("AuthTokenError", () => {
	// covers: AC-6
	it("keeps the provider's error as cause and says the provider failed", () => {
		// Arrange
		const cause = new Error("login required");

		// Act
		const error = new AuthTokenError({ method: "GET", url: URL, cause });

		// Assert
		expect(error).toMatchObject({
			name: "AuthTokenError",
			method: "GET",
			url: URL,
		});
		expect(error.cause).toBe(cause);
		expect(error.message).toBe(`GET ${URL} failed: auth token provider failed`);
		expect(error).toBeInstanceOf(CopilotApiError);
	});

	// covers: AC-6
	it("has no cause and says the token was empty when no cause is given", () => {
		// Act
		const error = new AuthTokenError({ method: "POST", url: URL });

		// Assert
		expect("cause" in error).toBe(false);
		expect(error.message).toBe(
			`POST ${URL} failed: auth token provider returned an empty token`,
		);
	});

	it("treats an explicit undefined cause as a provider failure", () => {
		// Act
		const error = new AuthTokenError({
			method: "GET",
			url: URL,
			cause: undefined,
		});

		// Assert
		expect("cause" in error).toBe(true);
		expect(error.cause).toBeUndefined();
		expect(error.message).toBe(`GET ${URL} failed: auth token provider failed`);
	});
});
