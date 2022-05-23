import type {
  ParseActions,
  QuarkActions,
  QuarkContext,
  QuarkSetterFn,
  SetStateAction,
  WithMiddlewareType,
} from "../Types";
import { CancelUpdate } from "./CancelUpdate";
import { propagateError } from "./PropagateError";

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
  self: QuarkContext<T, ET>,
  setState: QuarkSetterFn<T, ET>,
  actions: A
): ParseActions<A> {
  return Object.fromEntries(
    Object.entries(actions).map(([actionName, actionMethod]) => {
      // @ts-expect-error
      actionMethod = actionMethod.bind(actions);
      const wrappedAction = (...args: ARGS) => {
        let newState: SetStateAction<T, ET, WithMiddlewareType<T, ET>>;
        try {
          newState = actionMethod(self.value, ...args);
          return setState(newState);
        } catch (e) {
          if (CancelUpdate.isCancel(e)) {
            return;
          }
          if (!(newState! instanceof Promise)) {
            const err = propagateError(
              e,
              "State update was unsuccessful due to an error."
            );

            console.error(err);
          }
          throw e;
        }
      };
      return [actionName, wrappedAction];
    })
  ) as unknown as ParseActions<A>;
}
