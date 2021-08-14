import type {
  ParseActions,
  QuarkActions,
  QuarkContext,
  QuarkSetterFn,
} from "../Types";

/** @internal */
export function generateCustomActions<
  T,
  ARGS extends any[],
  ET,
  A extends QuarkActions<T, ET, ARGS>
>(
  self: QuarkContext<T, any, ET>,
  setState: QuarkSetterFn<T, ET>,
  actions: A
): ParseActions<A> {
  return Object.fromEntries(
    Object.entries(actions).map(([actionName, actionMethod]) => {
      const wrappedAction = (...args: ARGS) => {
        const newState = actionMethod(self.value, ...args);
        setState(newState);
      };
      return [actionName, wrappedAction];
    })
  ) as unknown as ParseActions<A>;
}
