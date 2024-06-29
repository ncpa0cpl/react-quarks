import { InitiateActionFn, ParseActions, QuarkActions } from "../Types/Actions";

/**
 * Generates 'action' function based on the actions defined in the Quark config.
 *
 * Each 'action' definition takes the Quark state value as it's first argument
 * and returns a new state value.
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
  M,
  A extends QuarkActions<T, M, ARGS>,
>(initiateAction: InitiateActionFn<T, M>, actions: A): ParseActions<A> {
  return Object.fromEntries(
    Object.entries(actions).map(([actionName, actionMethod]) => {
      actionMethod = actionMethod.bind(actions);
      const wrappedAction = (...args: ARGS) => {
        return initiateAction((api) => actionMethod(api, ...args));
      };
      return [actionName, wrappedAction];
    }),
  ) as unknown as ParseActions<A>;
}
