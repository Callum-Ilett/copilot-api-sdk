import { describe, expect, it } from "vitest";
import { sum } from "@/sum/sum";

describe("sum", () => {
	// covers: AC-1
	it("adds two numbers", () => {
		expect(sum(1, 2)).toBe(3);
	});

	it("adds negative numbers and zero", () => {
		expect(sum(-5, 3)).toBe(-2);
		expect(sum(0, 0)).toBe(0);
		expect(sum(7, -7)).toBe(0);
	});

	// covers: AC-4
	it("passes floating point results through without rounding", () => {
		expect(sum(0.1, 0.2)).toBe(0.30000000000000004);
	});

	// covers: AC-4
	it("passes NaN through", () => {
		expect(sum(Number.NaN, 1)).toBeNaN();
	});

	// covers: AC-4
	it("passes Infinity through", () => {
		expect(sum(Number.POSITIVE_INFINITY, 1)).toBe(Number.POSITIVE_INFINITY);
		expect(sum(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY)).toBeNaN();
	});

	// covers: AC-4
	it("does not reject non number input from plain JavaScript callers", () => {
		const fromJs = "1" as unknown as number;

		expect(() => sum(fromJs, 2)).not.toThrow();
		expect(sum(fromJs, 2)).toBe("12");
	});
});
