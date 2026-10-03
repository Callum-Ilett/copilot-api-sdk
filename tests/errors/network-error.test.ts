import { describe, expect, it } from "vitest";
import { CopilotApiError } from "@/errors/copilot-api-error";
import { NetworkError } from "@/errors/network-error";

const URL = "https://api.example.com/v1/chats";

describe("NetworkError", () => {
	// covers: AC-8
	it("keeps the method, url, aborted flag, and cause by reference", () => {
		// Arrange
		const cause = new Error("socket hang up");

		// Act
		const error = new NetworkError({
			method: "PATCH",
			url: URL,
			aborted: false,
			cause,
		});

		// Assert
		expect(error).toMatchObject({
			name: "NetworkError",
			method: "PATCH",
			url: URL,
			aborted: false,
		});
		expect(error.cause).toBe(cause);
		expect(error).toBeInstanceOf(CopilotApiError);
	});

	it("says no response was received when not aborted", () => {
		// Act
		const error = new NetworkError({
			method: "GET",
			url: URL,
			aborted: false,
			cause: undefined,
		});

		// Assert
		expect(error.message).toBe(`GET ${URL} failed: no response received`);
	});

	it("says the request was aborted when cancelled", () => {
		// Act
		const error = new NetworkError({
			method: "GET",
			url: URL,
			aborted: true,
			cause: undefined,
		});

		// Assert
		expect(error.message).toBe(`GET ${URL} failed: request aborted`);
	});
});
