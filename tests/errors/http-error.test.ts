import { describe, expect, it } from "vitest";
import { CopilotApiError } from "@/errors/copilot-api-error";
import { HttpError } from "@/errors/http-error";

const URL = "https://api.example.com/v1/chats";

describe("HttpError", () => {
	// covers: AC-7
	it("copies every response detail onto the error", () => {
		// Act
		const error = new HttpError({
			status: 418,
			statusText: "I'm a teapot",
			method: "POST",
			url: URL,
			data: { e: 1 },
		});

		// Assert
		expect(error).toMatchObject({
			name: "HttpError",
			status: 418,
			statusText: "I'm a teapot",
			method: "POST",
			url: URL,
			data: { e: 1 },
		});
	});

	it("is a CopilotApiError and an Error", () => {
		// Act
		const error = new HttpError({
			status: 500,
			statusText: "Internal Server Error",
			method: "GET",
			url: URL,
			data: null,
		});

		// Assert
		expect(error).toBeInstanceOf(CopilotApiError);
		expect(error).toBeInstanceOf(Error);
	});

	it("reads `<METHOD> <url> failed: <status> <statusText>`", () => {
		// Act
		const error = new HttpError({
			status: 404,
			statusText: "Not Found",
			method: "DELETE",
			url: URL,
			data: null,
		});

		// Assert
		expect(error.message).toBe(`DELETE ${URL} failed: 404 Not Found`);
	});

	it("leaves no trailing space when the status text is empty", () => {
		// Act
		const error = new HttpError({
			status: 500,
			statusText: "",
			method: "GET",
			url: URL,
			data: null,
		});

		// Assert
		expect(error.message).toBe(`GET ${URL} failed: 500`);
	});

	it("has no cause", () => {
		// Act
		const error = new HttpError({
			status: 400,
			statusText: "Bad Request",
			method: "PUT",
			url: URL,
			data: null,
		});

		// Assert
		expect("cause" in error).toBe(false);
	});

	// covers: AC-12 (spec 0005)
	it('has the fixed code "HTTP_ERROR"', () => {
		// Act
		const error = new HttpError({
			status: 404,
			statusText: "Not Found",
			method: "GET",
			url: URL,
			data: null,
		});

		// Assert
		expect(error.code).toBe("HTTP_ERROR");
	});
});
