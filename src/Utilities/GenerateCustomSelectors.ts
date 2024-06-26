import type {
  ParseHookSelectors,
  QuarkContext,
  QuarkSelector,
  QuarkSelectors,
  StandaloneSelectors,
} from "../Types";
import { generateStandaloneSelectorHook } from ".";

/**
 * @internal
 */
function generatePredefinedSelectHook<T, U, ET, ARGS extends any[]>(
  self: QuarkContext<T, ET>,
  selector: QuarkSelector<T, ARGS, U>,
) {
  const hook = generateStandaloneSelectorHook(self);
  return (...args: ARGS) => hook(selector, ...args);
}

/**
 * Generate `selector` React Hooks based on the selectors defined in the Quark
 * config.
 *
 * @param self Context of the Quark in question
 * @param selectors An object containing selector definitions, each selector
 *   must be a function accepting the Quark state value in it's first argument
 * @returns An object with the same structure as `selectors` but each method it
 *   contains is a React Hook
 * @internal
 */
export function generateCustomSelectors<
  T,
  ET,
  S extends QuarkSelectors<T, any>,
>(self: QuarkContext<T, ET>, selectors: S): StandaloneSelectors<T, S> {
  const entries = Object.entries(selectors);
  return Object.fromEntries(
    entries
      .map(([selectorName, selectorMethod]) => {
        return [
          selectorName,
          (...args: any[]) => selectorMethod(self.value, ...args),
        ];
      })
      .concat([["$", (selectFn: Function) => selectFn(self.value)]]),
  ) as unknown as StandaloneSelectors<T, S>;
}

/**
 * Generate `selector` React Hooks based on the selectors defined in the Quark
 * config.
 *
 * @param self Context of the Quark in question
 * @param selectors An object containing selector definitions, each selector
 *   must be a function accepting the Quark state value in it's first argument
 * @returns An object with the same structure as `selectors` but each method it
 *   contains is a React Hook
 * @internal
 */
export function generateCustomHookSelectors<
  T,
  ET,
  S extends QuarkSelectors<T, any>,
>(self: QuarkContext<T, ET>, selectors: S): ParseHookSelectors<S> {
  const entries = Object.entries(selectors);
  return Object.fromEntries(
    entries.map(([selectorName, selectorMethod]) => {
      const wrappedSelector = generatePredefinedSelectHook(
        self,
        selectorMethod.bind(selectors),
      );
      return [selectorName, wrappedSelector];
    }),
  ) as unknown as ParseHookSelectors<S>;
}
