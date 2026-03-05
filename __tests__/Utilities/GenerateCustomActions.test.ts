import cloneDeep from "lodash.clonedeep";
import { beforeEach, describe, expect, it, vitest } from "vitest";
import { QuarkActions, QuarkContext } from "../../src";
import { generateCustomActions } from "../../src/Utilities/GenerateCustomActions";
import { Immediate } from "../../src/Utilities/StateUpdates/Immediate";
import { getTestQuarkContext } from "../helpers";

describe("generateCustomActions()", () => {
  let context: QuarkContext<any>;
  const setStateMock = vitest.fn();

  beforeEach(() => {
    vitest.resetAllMocks();
  });

  it("should generate a new object with the same methods as it was provided", () => {
    context = getTestQuarkContext({ setter: setStateMock });

    const actions = {
      append(state, ...args: string[]) {
      },
      trim(state) {
      },
    } satisfies QuarkActions<any>;

    const bindedActions = generateCustomActions(
      context,
      () => Immediate.resolve(),
      actions,
    );

    expect(bindedActions).toMatchObject({
      append: expect.any(Function),
      trim: expect.any(Function),
    });

    expect(context.actions.get(actions.append)).toEqual(bindedActions.append);
    expect(context.actions.get(actions.trim)).toEqual(bindedActions.trim);
  });

  it("should generate new methods that are provided with the context value automatically when called", () => {
    const initValue = { value: "foo", prev: "" };

    context = getTestQuarkContext({ value: initValue, setter: setStateMock });

    const appendMock = vitest.fn(
      (state: typeof initValue, newValue: string) => {
        return { value: newValue, prev: state.value };
      },
    );

    const actions = {
      add(api, newValue: string) {
        const s = appendMock(api.get(), newValue);
        api.set(s);
      },
    } satisfies QuarkActions<any>;

    const bindedActions = generateCustomActions(
      context,
      () => Immediate.resolve(),
      actions,
    );

    bindedActions.add("bar");

    expect(appendMock).toHaveBeenCalledTimes(1);
    expect(appendMock).toHaveBeenCalledWith(
      expect.objectContaining({ value: "foo", prev: "" }),
      "bar",
    );

    expect(setStateMock).toHaveBeenCalledTimes(1);
    expect(setStateMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ value: "bar", prev: "foo" }),
    );
  });

  it("should generate new methods that call the setState method", () => {
    const initValue = " foo-bar";

    context = getTestQuarkContext({ value: initValue, setter: setStateMock });

    const actions = {
      append(api, ...args: string[]) {
        const s = api.get() + args.toString();
        api.set(s);
      },
      trim(api) {
        const s = api.get().trim();
        api.set(s);
      },
    } satisfies QuarkActions<any>;

    const bindedActions = generateCustomActions(
      context,
      () => Immediate.resolve(),
      actions,
    );

    bindedActions.append("-baz");

    expect(setStateMock).toHaveBeenCalledTimes(1);
    expect(setStateMock).toHaveBeenCalledWith(
      expect.any(Object),
      `${context.value}-baz`,
    );

    setStateMock.mockReset();

    bindedActions.trim();

    expect(setStateMock).toHaveBeenCalledTimes(1);
    expect(setStateMock).toHaveBeenCalledWith(
      expect.any(Object),
      `foo-bar`,
    );
  });
});
