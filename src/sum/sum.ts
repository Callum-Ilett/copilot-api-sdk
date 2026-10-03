import type { SumFn } from "@/sum/types";

/**
 * Adds two numbers.
 *
 * Follows JavaScript `+` semantics exactly, with no runtime input check:
 * floating point results pass through (`sum(0.1, 0.2)` is
 * `0.30000000000000004`), as do `NaN` and `Infinity`. Types are the only
 * guard, so non number arguments from plain JavaScript callers are not
 * rejected.
 *
 * @param a - The first addend.
 * @param b - The second addend.
 * @returns `a + b`.
 *
 * @example
 * ```ts
 * sum(1, 2); // 3
 * ```
 */
export const sum: SumFn = (a, b) => a + b;
