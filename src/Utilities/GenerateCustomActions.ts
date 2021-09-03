import type {
  ParseActions,
  QuarkActions,
  QuarkContext,
  QuarkSetterFn,
} from "../Types";

/**
 * Generates 'action' function based on the actions defined in the Quark config.
 *
 * Each 'action' definition takes the Quark state value as it's first argument and
 * returns a new state value.
 *
 * @param self Context of the Quark in question
 * @param setState Function allowing for updating the current state of the Quark
 * @param actions Object containing 'action' definitions
 * @returns An object with the same structure as the `actions` argument
 * @internal
 */
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
