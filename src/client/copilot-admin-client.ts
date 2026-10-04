import { AccountsApi } from "@/accounts/accounts-api";
import type { AccountsResource } from "@/accounts/types";
import type { CopilotAdminClientOptions } from "@/client/types";
import { HttpClient } from "@/http/http-client";
import type { AuthTokenProvider } from "@/http/types";

/**
 * The entry point for the Copilot API admin routes.
 *
 * @example
 * ```ts
 * const client = new CopilotAdminClient({ baseURL: "https://copilot.example.com" });
 * client.setAuthTokenProvider(() => auth.getAccessToken());
 * const accounts = await client.accounts.list();
 * ```
 */
export class CopilotAdminClient {
	/** Lists, gets, creates, updates, and deletes accounts. */
	readonly accounts: AccountsResource;
	readonly #http: HttpClient;

	/**
	 * @param options - Where the API lives.
	 */
	constructor(options: CopilotAdminClientOptions) {
		this.#http = new HttpClient(options.baseURL);
		this.accounts = new AccountsApi(this.#http);
	}

	/**
	 * Sets where bearer tokens come from. Called once per request; affects
	 * only requests started after this call. Without one, requests are sent
	 * with no `Authorization` header.
	 *
	 * @param provider - Resolves to a non empty access token.
	 */
	setAuthTokenProvider(provider: AuthTokenProvider): void {
		this.#http.setAuthTokenProvider(provider);
	}
}
