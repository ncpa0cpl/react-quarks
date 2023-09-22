import { generateSelectHook } from ".";
import type {
  ParseSelectors,
  QuarkContext,
  QuarkSelector,
  QuarkSelectors,
} from "../Types";

/** @internal */
function generatePredefinedSelectHook<T, U, ET, ARGS extends any[]>(
  self: QuarkContext<T, ET>,
  selector: QuarkSelector<T, ARGS, U>,
) {
  const hook = generateSelectHook(self);
  return (...args: ARGS) => hook(selector, ...args);
}

function capitalize(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}

/**
 * Generate `selector` React Hooks based on the selectors defined in the Quark config.
 *
 * @param self Context of the Quark in question
 * @param selectors An object containing selector definitions, each selector must be
 *   a function accepting the Quark state value in it's first argument
 * @returns An object with the same structure as `selectors` but each method it
 *   contains is a React Hook
 * @internal
 */
export function generateCustomSelectors<T, ET, S extends QuarkSelectors<T, any>>(
  self: QuarkContext<T, ET>,
  selectors: S,
): ParseSelectors<S> {
  const entries = Object.entries(selectors);
  return Object.fromEntries(
    entries
      .map(([selectorName, selectorMethod]) => {
        const wrappedSelector = generatePredefinedSelectHook(
          self,
          selectorMethod.bind(selectors),
        );
        return [`use${capitalize(selectorName)}`, wrappedSelector];
      })
      .concat(
        entries.map(([selectorName, selectorMethod]) => {
          return [
            `select${capitalize(selectorName)}`,
            (...args: any[]) => selectorMethod(self.value, ...args),
          ];
        }),
      ),
  ) as unknown as ParseSelectors<S>;
}
