import { renderHook } from "@testing-library/react-hooks";
import cloneDeep from "lodash.clonedeep";
import { beforeEach, describe, expect, it, vitest } from "vitest";
import { generateCustomSelectors } from "../../src/Utilities/GenerateCustomSelectors";
import { getTestQuarkContext } from "../helpers";

const entries = Object.entries as <T>(o: T) => [[keyof T, T[keyof T]]];

describe("generateCustomSelectors()", () => {
  beforeEach(() => {
    vitest.resetAllMocks();
  });

  it("should generate a new object with the same named methods as it was provided", () => {
    const context = getTestQuarkContext({
      value: { prop1: "foo", prop2: "bar" },
    });

    const originalContext = cloneDeep(context);

    const selectors = generateCustomSelectors(
      context,
      entries({
        prop1(state) {
          return state.prop1;
        },
        prop2(state) {
          return state.prop2;
        },
      }),
    );

    expect(selectors).toMatchObject({
      prop1: expect.any(Function),
      prop2: expect.any(Function),
    });

    // Assert the context didn't change
    expect(context).toMatchObject(originalContext);
  });

  it("should generate new methods that are provided with the context value automatically when called", () => {
    const initValue = { prop1: "foo", prop2: "bar" };

    type QT = typeof initValue;

    const context = getTestQuarkContext({ value: initValue });

    const useSelectMock = vitest.fn((state: QT) => {
      return state.prop1;
    });

    const selectors = generateCustomSelectors<
      typeof initValue,
      any,
      { prop1(): string }
    >(
      context,
      entries({
        prop1: useSelectMock,
      }),
    );

    const hook = renderHook(() => {
      return selectors.prop1();
    });

    expect(useSelectMock).not.toHaveBeenCalledTimes(0);
    expect(useSelectMock).toHaveBeenLastCalledWith(initValue);
    expect(useSelectMock.mock.results.reverse()[0].value).toEqual("foo");
    expect(useSelectMock.mock.results.reverse()[0].value).toEqual(
      hook.result.current,
    );
  });
});
