import { describe, expect, it } from "vitest";
import { AccountsApi } from "@/accounts/accounts-api";
import { CopilotAdminClient } from "@/client/copilot-admin-client";

describe("CopilotAdminClient", () => {
	// covers: AC-1
	it("exposes accounts with the five methods and setAuthTokenProvider", () => {
		// Act
		const client = new CopilotAdminClient({
			baseURL: "https://copilot.example.com",
		});

		// Assert
		for (const method of ["list", "get", "create", "update", "delete"]) {
			expect(client.accounts).toHaveProperty(method, expect.any(Function));
		}
		expect(() => client.setAuthTokenProvider(async () => "t")).not.toThrow();
	});

	// covers: AC-1
	it("builds accounts as an AccountsApi", () => {
		// Act
		const client = new CopilotAdminClient({
			baseURL: "https://copilot.example.com",
		});

		// Assert
		expect(client.accounts).toBeInstanceOf(AccountsApi);
	});

	// covers: AC-15
	it("keeps its HttpClient private", () => {
		// Act
		const client = new CopilotAdminClient({
			baseURL: "https://copilot.example.com",
		});

		// Assert
		expect(Object.keys(client)).toEqual(["accounts"]);
	});
});
