import { describe, expect, it } from "vitest";
import { sum } from "@/sum/sum";

// AC-2 and AC-3 are proved by `pnpm build` (publint and arethetypeswrong) and
// `pnpm typecheck`; AC-4 is documented in the TSDoc on `sum`, not tested.
describe("sum", () => {
	// covers: AC-1
	it("adds two numbers", () => {
		expect(sum(1, 2)).toBe(3);
	});
});
