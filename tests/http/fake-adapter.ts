import type {
	AxiosAdapter,
	AxiosResponse,
	InternalAxiosRequestConfig,
} from "axios";

type QueuedResponse = { status: number; statusText?: string; data?: unknown };
type Queued =
	| { kind: "response"; response: QueuedResponse }
	| { kind: "error"; make: (config: InternalAxiosRequestConfig) => unknown };

/**
 * Stands in for the axios transport: records every request config it gets
 * and answers with the next queued response or error (200 `null` when the
 * queue is empty).
 */
export class FakeAdapter {
	readonly requests: InternalAxiosRequestConfig[] = [];
	readonly #queue: Queued[] = [];

	respondWith(response: QueuedResponse): this {
		this.#queue.push({ kind: "response", response });
		return this;
	}

	failWith(make: (config: InternalAxiosRequestConfig) => unknown): this {
		this.#queue.push({ kind: "error", make });
		return this;
	}

	readonly adapter: AxiosAdapter = async (config) => {
		this.requests.push(config);
		const next = this.#queue.shift() ?? {
			kind: "response",
			response: { status: 200, data: null },
		};
		if (next.kind === "error") throw next.make(config);
		const response: AxiosResponse = {
			status: next.response.status,
			statusText: next.response.statusText ?? "",
			data: next.response.data,
			headers: {},
			config,
		};
		return response;
	};
}
