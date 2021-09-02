import { cloneDeep } from "lodash";
import { generateCustomActions } from "../../src/Utilities";
import { getTestQuarkContext } from "../helpers";

describe("generateCustomActions()", () => {
  const setStateMock = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("should generate a new object with the same methods as it was provided", () => {
    const context = getTestQuarkContext();

    const originalContext = cloneDeep(context);

    const actions = {
      append(state: string, ...args: string[]) {
        return state + args.toString();
      },
      trim(state: string) {
        return state.trim();
      },
    };

    const bindedActions = generateCustomActions(context, setStateMock, actions);

    expect(bindedActions).toMatchObject({
      append: expect.any(Function),
      trim: expect.any(Function),
    });

    // Assert nothing in the context changed
    expect(context).toMatchObject(originalContext);
  });

  it("should generate new methods that are provided with the context value automatically when called", () => {
    const initValue = { value: "foo", prev: "" };

    const context = getTestQuarkContext({ value: initValue });

    const appendMock = jest.fn((state: typeof initValue, newValue: string) => {
      return { value: newValue, prev: state.value };
    });

    const actions = {
      add: appendMock,
    };

    const bindedActions = generateCustomActions(context, setStateMock, actions);

    bindedActions.add("bar");

    expect(appendMock).toHaveBeenCalledTimes(1);
    expect(appendMock).toHaveBeenCalledWith(
      expect.objectContaining({ value: "foo", prev: "" }),
      "bar"
    );

    expect(setStateMock).toHaveBeenCalledTimes(1);
    expect(setStateMock).toHaveBeenCalledWith(
      expect.objectContaining({ value: "bar", prev: "foo" })
    );
  });

  it("should generate new methods that call the setState method", () => {
    const initValue = " foo-bar";

    const context = getTestQuarkContext({ value: initValue });

    const actions = {
      append(state: string, ...args: string[]) {
        return state + args.toString();
      },
      trim(state: string) {
        return state.trim();
      },
    };

    const bindedActions = generateCustomActions(context, setStateMock, actions);

    bindedActions.append("-baz");

    expect(setStateMock).toHaveBeenCalledTimes(1);
    expect(setStateMock).toHaveBeenCalledWith(`${context.value}-baz`);

    setStateMock.mockReset();

    bindedActions.trim();

    expect(setStateMock).toHaveBeenCalledTimes(1);
    expect(setStateMock).toHaveBeenCalledWith(`foo-bar`);
  });
});
