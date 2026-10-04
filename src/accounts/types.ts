import type { z } from "zod";
import type {
	AccountSchema,
	CreateAccountRequestSchema,
	DeletedAccountSchema,
	UpdateAccountRequestSchema,
	UpdateAccountResultSchema,
} from "@/accounts/schemas";

/**
 * An account in the Copilot API.
 *
 * `createdAt` is an ISO 8601 datetime string; convert it with `new Date()`
 * when you need a date.
 */
export type Account = z.output<typeof AccountSchema>;

/**
 * Input for `accounts.create`. `name` must not be blank (it is sent
 * trimmed) and `logoUrl` must be an http or https URL.
 */
export type CreateAccountRequest = z.input<typeof CreateAccountRequestSchema>;

/**
 * Input for `accounts.update`. Same rules as create; both fields are
 * required, so send the current value of a field you are not changing.
 */
export type UpdateAccountRequest = z.input<typeof UpdateAccountRequestSchema>;

/**
 * What `accounts.update` resolves to: the updated account, or
 * `{ success: true }` when the API had nothing to change. Narrow it with
 * `"success" in result`.
 */
export type UpdateAccountResult = z.output<typeof UpdateAccountResultSchema>;

/** What `accounts.delete` resolves to: the id of the deleted account. */
export type DeletedAccount = z.output<typeof DeletedAccountSchema>;

/**
 * Anything that can cancel a call. A real `AbortSignal` (from an
 * `AbortController`) satisfies it.
 */
export type CancelSignal = {
	readonly aborted: boolean;
	addEventListener?: (...args: never[]) => unknown;
	removeEventListener?: (...args: never[]) => unknown;
	onabort?: ((...args: never[]) => unknown) | null;
};

/** Options every accounts method takes as its last argument. */
export type AccountRequestOptions = {
	/** Cancels the call when aborted; it then rejects with `NetworkError` (`aborted: true`). */
	signal?: CancelSignal;
};

/**
 * The accounts admin routes, under `client.admin.accounts`.
 *
 * Every method checks its input before sending (rejecting with
 * `ValidationError`, `direction: "request"`) and checks the API's answer
 * before resolving (`ValidationError`, `direction: "response"`). API
 * failures reject with `HttpError`, `NetworkError`, or `AuthTokenError`.
 */
export interface AccountsResource {
	/**
	 * Lists every account.
	 *
	 * @param options - A cancel signal.
	 * @returns All accounts; an empty array when there are none.
	 */
	list(options?: AccountRequestOptions): Promise<Account[]>;

	/**
	 * Gets one account.
	 *
	 * @param id - The account id, a UUID.
	 * @param options - A cancel signal.
	 * @returns The account. A missing one rejects with `HttpError` (`status: 404`).
	 */
	get(id: string, options?: AccountRequestOptions): Promise<Account>;

	/**
	 * Creates an account.
	 *
	 * @param input - The new account's name and logo URL.
	 * @param options - A cancel signal.
	 * @returns The created account.
	 */
	create(
		input: CreateAccountRequest,
		options?: AccountRequestOptions,
	): Promise<Account>;

	/**
	 * Updates an account. Both fields are sent.
	 *
	 * @param id - The account id, a UUID.
	 * @param input - The account's new name and logo URL.
	 * @param options - A cancel signal.
	 * @returns The updated account, or `{ success: true }` when nothing changed.
	 */
	update(
		id: string,
		input: UpdateAccountRequest,
		options?: AccountRequestOptions,
	): Promise<UpdateAccountResult>;

	/**
	 * Deletes an account.
	 *
	 * @param id - The account id, a UUID.
	 * @param options - A cancel signal.
	 * @returns The deleted account's id.
	 */
	delete(id: string, options?: AccountRequestOptions): Promise<DeletedAccount>;
}
