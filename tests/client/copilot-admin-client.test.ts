import { describe, expect, it } from "vitest";
import { AccountsApi } from "@/accounts/accounts-api";
import { AdminApi } from "@/admin/admin-api";
import { CopilotAdminClient } from "@/client/copilot-admin-client";
import { HttpClient } from "@/http/http-client";

describe("CopilotAdminClient", () => {
	// covers: AC-1
	it("exposes admin.accounts with the five methods and setAuthTokenProvider", () => {
		// Act
		const client = new CopilotAdminClient({
			baseURL: "https://copilot.example.com",
		});

		// Assert
		for (const method of ["list", "get", "create", "update", "delete"]) {
			expect(client.admin.accounts).toHaveProperty(
				method,
				expect.any(Function),
			);
		}
		expect(() => client.setAuthTokenProvider(async () => "t")).not.toThrow();
	});

	// covers: AC-15
	it("keeps its HttpClient private", () => {
		// Act
		const client = new CopilotAdminClient({
			baseURL: "https://copilot.example.com",
		});

		// Assert
		expect(Object.keys(client)).toEqual(["admin"]);
	});
});

describe("AdminApi", () => {
	// covers: AC-1
	it("builds an AccountsApi over the given HttpClient", () => {
		// Act
		const admin = new AdminApi(new HttpClient("https://copilot.example.com"));

		// Assert
		expect(admin.accounts).toBeInstanceOf(AccountsApi);
	});
});
