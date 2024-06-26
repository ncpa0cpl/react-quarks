import { QuarkContext } from "../Types";
import {
  InitiateProcedureFn,
  ParseProcedures,
  QuarkProcedures,
} from "../Types/Procedures";

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
export function generateCustomProcedures<
  T,
  ARGS extends any[],
  ET,
  P extends QuarkProcedures<T, ARGS>,
>(
  self: QuarkContext<T, ET>,
  initiateProcedure: InitiateProcedureFn<T>,
  procedures: P,
): ParseProcedures<P> {
  return Object.fromEntries(
    Object.entries(procedures).map(([actionName, generatorFactory]) => {
      const wrappedAction = (...args: ARGS) => {
        return initiateProcedure(() => generatorFactory(self.value, ...args));
      };
      return [actionName, wrappedAction];
    }),
  ) as unknown as ParseProcedures<P>;
}
