import { type ParseContext, parseWith } from "@/accounts/parse";
import {
	AccountIdSchema,
	AccountListSchema,
	AccountSchema,
	CreateAccountRequestSchema,
	DeletedAccountSchema,
	UpdateAccountRequestSchema,
	UpdateAccountResultSchema,
} from "@/accounts/schemas";
import type {
	Account,
	AccountRequestOptions,
	AccountsResource,
	CreateAccountRequest,
	DeletedAccount,
	UpdateAccountRequest,
	UpdateAccountResult,
} from "@/accounts/types";
import type { HttpClient } from "@/http/http-client";
import type { RequestOptions } from "@/http/options";

const PATH = "/api/admin/accounts";

/**
 * The accounts admin routes. Each method parses its input, calls the API
 * through `HttpClient`, and parses the response.
 *
 * Internal to the SDK; consumers see it as `AccountsResource`.
 */
export class AccountsApi implements AccountsResource {
	readonly #http: HttpClient;

	/**
	 * @param http - Sends the requests, with the bearer token.
	 */
	constructor(http: HttpClient) {
		this.#http = http;
	}

	async list(options?: AccountRequestOptions): Promise<Account[]> {
		const body = await this.#http.get(PATH, requestOptions(options));
		return parseWith(AccountListSchema, body, response("accounts.list", false));
	}

	async get(id: string, options?: AccountRequestOptions): Promise<Account> {
		const path = accountPath(id, "accounts.get", false);
		const body = await this.#http.get(path, requestOptions(options));
		return parseWith(AccountSchema, body, response("accounts.get", false));
	}

	async create(
		input: CreateAccountRequest,
		options?: AccountRequestOptions,
	): Promise<Account> {
		const data = parseWith(
			CreateAccountRequestSchema,
			input,
			request("accounts.create", true),
		);
		const body = await this.#http.post(PATH, data, requestOptions(options));
		return parseWith(AccountSchema, body, response("accounts.create", true));
	}

	async update(
		id: string,
		input: UpdateAccountRequest,
		options?: AccountRequestOptions,
	): Promise<UpdateAccountResult> {
		const path = accountPath(id, "accounts.update", true);
		const data = parseWith(
			UpdateAccountRequestSchema,
			input,
			request("accounts.update", true),
		);
		const body = await this.#http.patch(path, data, requestOptions(options));
		return parseWith(
			UpdateAccountResultSchema,
			body,
			response("accounts.update", true),
		);
	}

	async delete(
		id: string,
		options?: AccountRequestOptions,
	): Promise<DeletedAccount> {
		const path = accountPath(id, "accounts.delete", true);
		const body = await this.#http.delete(path, requestOptions(options));
		return parseWith(
			DeletedAccountSchema,
			body,
			response("accounts.delete", true),
		);
	}
}

function accountPath(
	id: unknown,
	operation: string,
	mutating: boolean,
): string {
	const parsed = parseWith(AccountIdSchema, id, request(operation, mutating));
	return `${PATH}/${parsed}`;
}

// The signal key is left out when unset, never sent as undefined
// (exactOptionalPropertyTypes).
function requestOptions(options?: AccountRequestOptions): RequestOptions {
	return options?.signal ? { signal: options.signal } : {};
}

function request(operation: string, mutating: boolean): ParseContext {
	return { direction: "request", operation, mutating };
}

function response(operation: string, mutating: boolean): ParseContext {
	return { direction: "response", operation, mutating };
}
