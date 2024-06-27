import { describe, expect, it, vitest } from "vitest";
import { createCachedSelector } from "../../src/Utilities/CreateCachedSelector";

describe("createCachedSelector()", () => {
  it("memoizes the result of the selector", () => {
    const rawSelector = vitest.fn((box: { value: number }) => box.value);

    const selector = createCachedSelector(rawSelector);

    const box = { value: 1 };
    const selected1 = selector(box);
    const selected2 = selector(box);

    expect(rawSelector).toHaveBeenCalledTimes(1);
    expect(selected1).toBe(selected2);
  });

  it("memoizes when the selector has many arguments", () => {
    const rawSelector = vitest.fn((a: number, b: number) => a + b);

    const selector = createCachedSelector(rawSelector);

    const selected1 = selector(1, 2);
    const selected2 = selector(1, 2);

    expect(rawSelector).toHaveBeenCalledTimes(1);
    expect(selected1).toBe(selected2);
  });

  it("recomputes if any of the arguments change", () => {
    const rawSelector = vitest.fn((a: number, b: number) => a + b);

    const selector = createCachedSelector(rawSelector);

    const selected1 = selector(1, 2);
    const selected2 = selector(1, 3);

    expect(rawSelector).toHaveBeenCalledTimes(2);
    expect(selected1).not.toBe(selected2);
  });

  it("memoizes more than the last result", () => {
    const rawSelector = vitest.fn((a: number, b: number) => a + b);

    const selector = createCachedSelector(rawSelector);

    const selected1 = selector(1, 2);
    const selected2 = selector(1, 3);
    const selected3 = selector(1, 2);

    expect(rawSelector).toHaveBeenCalledTimes(2);
    expect(selected1).toBe(selected3);
    expect(selected1).not.toBe(selected2);
  });

  it("once more than 11 calls are memoized, one that was used last is forgotten", () => {
    const rawSelector = vitest.fn((a: number, b: number) => a + b);

    const selector = createCachedSelector(rawSelector);

    const selected1 = selector(1, 1);
    const selected2 = selector(1, 2);
    const selected3 = selector(1, 3);
    const selected4 = selector(1, 4);
    const selected5 = selector(1, 5);
    const selected6 = selector(1, 6);
    const selected7 = selector(1, 7);
    const selected8 = selector(1, 8);
    const selected9 = selector(1, 9);
    const selected10 = selector(1, 10);
    const selected11 = selector(1, 1);
    selector(1, 30); // 1 + 2  should be forgotten at this point

    expect(rawSelector).toHaveBeenCalledTimes(11);
    expect(selected1).toBe(2);
    expect(selected2).toBe(3);
    expect(selected3).toBe(4);
    expect(selected4).toBe(5);
    expect(selected5).toBe(6);
    expect(selected6).toBe(7);
    expect(selected7).toBe(8);
    expect(selected8).toBe(9);
    expect(selected9).toBe(10);
    expect(selected10).toBe(11);
    expect(selected11).toBe(2);

    // should be still cached
    selector(1, 3);
    expect(rawSelector).toHaveBeenCalledTimes(11);

    // should be recomputed
    selector(1, 2);
    expect(rawSelector).toHaveBeenCalledTimes(12);
  });
});
