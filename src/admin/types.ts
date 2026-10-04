import type { AccountsResource } from "@/accounts/types";

/**
 * The admin resources, under `client.admin`.
 */
export interface AdminResources {
	/** Lists, gets, creates, updates, and deletes accounts. */
	readonly accounts: AccountsResource;
}
