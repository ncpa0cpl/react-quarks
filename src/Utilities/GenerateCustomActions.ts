import { InitiateActionFn, ParseActions, QuarkActions } from "../Types/Actions";

/**
 * Generates 'action' function based on the actions defined in the Quark config.
 *
 * Each 'action' definition takes the Quark state value as it's first argument
 * and returns a new state value.
 *
 * @param initiateAction function that will start any given action
 * @param actions Object containing 'action' definitions
 * @returns An object with the same structure as the `actions` argument
 * @internal
 */
export function generateCustomActions<
  T,
  A extends QuarkActions<T>,
>(initiateAction: InitiateActionFn<T>, actions: A): ParseActions<A> {
  return Object.fromEntries(
    Object.entries(actions).map(([actionName, actionMethod]) => {
      actionMethod = actionMethod.bind(actions);
      const wrappedAction = (...args: any[]) => {
        return initiateAction(actionMethod, args);
      };
      return [actionName, wrappedAction];
    }),
  ) as unknown as ParseActions<A>;
}
