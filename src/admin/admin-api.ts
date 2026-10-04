import { AccountsApi } from "@/accounts/accounts-api";
import type { AdminResources } from "@/admin/types";
import type { HttpClient } from "@/http/http-client";

/**
 * Groups the admin resources over one `HttpClient`.
 *
 * Internal to the SDK; consumers see it as `AdminResources`.
 */
export class AdminApi implements AdminResources {
	readonly accounts: AccountsApi;

	/**
	 * @param http - Shared by every admin resource.
	 */
	constructor(http: HttpClient) {
		this.accounts = new AccountsApi(http);
	}
}
