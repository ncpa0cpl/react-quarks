import { renderHook } from "@testing-library/react-hooks";
import { cloneDeep } from "lodash";
import { generateCustomSelectors } from "../../src/Utilities";
import { getTestQuarkContext } from "../helpers";

describe("generateCustomSelectors()", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("should generate a new object with the same named methods as it was provided", () => {
    const context = getTestQuarkContext({
      value: { prop1: "foo", prop2: "bar" },
    });

    const originalContext = cloneDeep(context);

    const selectors = generateCustomSelectors(context, {
      prop1(state) {
        return state.prop1;
      },
      prop2(state) {
        return state.prop2;
      },
    });

    expect(selectors).toMatchObject({
      useProp1: expect.any(Function),
      useProp2: expect.any(Function),
      selectProp1: expect.any(Function),
      selectProp2: expect.any(Function),
    });

    // Assert the context didn't change
    expect(context).toMatchObject(originalContext);
  });

  it("should generate new methods that are provided with the context value automatically when called", () => {
    const initValue = { prop1: "foo", prop2: "bar" };

    type QT = typeof initValue;

    const context = getTestQuarkContext({ value: initValue });

    const useSelectMock = jest.fn((state: QT) => {
      return state.prop1;
    });

    const selectors = generateCustomSelectors(context, {
      prop1: useSelectMock,
    });

    const hook = renderHook(() => {
      return selectors.useProp1();
    });

    expect(useSelectMock).not.toHaveBeenCalledTimes(0);
    expect(useSelectMock).toHaveBeenLastCalledWith(initValue);
    expect(useSelectMock.mock.results.reverse()[0].value).toEqual("foo");
    expect(useSelectMock.mock.results.reverse()[0].value).toEqual(
      hook.result.current,
    );
  });
});
