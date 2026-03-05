import cloneDeep from "lodash.clonedeep";
import { beforeEach, describe, expect, it, vitest } from "vitest";
import { QuarkActions, QuarkContext } from "../../src";
import { generateCustomActions } from "../../src/Utilities/GenerateCustomActions";
import { getTestQuarkContext } from "../helpers";

describe("generateCustomActions()", () => {
  let context: QuarkContext<any, any>;
  const setStateMock = vitest.fn();
  const initiateAction = (action: any, args?: any[]) => {
    if (typeof action === "function") {
      const api = {
        getState() {
          return context.value;
        },
        setState(s: any) {
          setStateMock(s);
        },
      };
      if (args) {
        action(api, ...args);
      } else {
        action(api);
      }
    } else {
      setStateMock(action);
    }
  };

  beforeEach(() => {
    vitest.resetAllMocks();
  });

  it("should generate a new object with the same methods as it was provided", () => {
    context = getTestQuarkContext();

    const originalContext = cloneDeep(context);

    const actions: QuarkActions<any, never[], any[]> = {
      append(state, ...args: string[]) {
      },
      trim(state) {
      },
    };

    const bindedActions = generateCustomActions(initiateAction, actions);

    expect(bindedActions).toMatchObject({
      append: expect.any(Function),
      trim: expect.any(Function),
    });

    // Assert nothing in the context changed
    expect(context).toMatchObject(originalContext);
  });

  it("should generate new methods that are provided with the context value automatically when called", () => {
    const initValue = { value: "foo", prev: "" };

    context = getTestQuarkContext({ value: initValue });

    const appendMock = vitest.fn(
      (state: typeof initValue, newValue: string) => {
        return { value: newValue, prev: state.value };
      },
    );

    const actions = {
      add(api, newValue: string) {
        const s = appendMock(api.getState(), newValue);
        api.setState(s);
      },
    } satisfies QuarkActions<any, never[], any[]>;

    const bindedActions = generateCustomActions(initiateAction, actions);

    bindedActions.add("bar");

    expect(appendMock).toHaveBeenCalledTimes(1);
    expect(appendMock).toHaveBeenCalledWith(
      expect.objectContaining({ value: "foo", prev: "" }),
      "bar",
    );

    expect(setStateMock).toHaveBeenCalledTimes(1);
    expect(setStateMock).toHaveBeenCalledWith(
      expect.objectContaining({ value: "bar", prev: "foo" }),
    );
  });

  it("should generate new methods that call the setState method", () => {
    const initValue = " foo-bar";

    context = getTestQuarkContext({ value: initValue });

    const actions = {
      append(api, ...args: string[]) {
        const s = api.getState() + args.toString();
        api.setState(s);
      },
      trim(api) {
        const s = api.getState().trim();
        api.setState(s);
      },
    } satisfies QuarkActions<any, never[], any[]>;

    const bindedActions = generateCustomActions(initiateAction, actions);

    bindedActions.append("-baz");

    expect(setStateMock).toHaveBeenCalledTimes(1);
    expect(setStateMock).toHaveBeenCalledWith(`${context.value}-baz`);

    setStateMock.mockReset();

    bindedActions.trim();

    expect(setStateMock).toHaveBeenCalledTimes(1);
    expect(setStateMock).toHaveBeenCalledWith(`foo-bar`);
  });
});
