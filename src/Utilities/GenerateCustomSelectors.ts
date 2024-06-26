import { useSyncExternalStore } from "use-sync-external-store/shim";
import type {
  ParseHookSelectors,
  QuarkContext,
  QuarkSelector,
  QuarkSelectors,
  StandaloneSelectors,
} from "../Types";

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
>(
  self: QuarkContext<T, ET>,
  selectors: Array<[k: keyof S, select: QuarkSelector<T, any>]>,
): StandaloneSelectors<T, S> {
  return Object.fromEntries(
    selectors
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
>(
  self: QuarkContext<T, ET>,
  selectors: Array<[k: keyof S, select: QuarkSelector<T, any>]>,
): ParseHookSelectors<S> {
  return Object.fromEntries(
    selectors.map(([selectorName, selector]) => {
      const boundSelector = (...args: any[]) => {
        return selector(self.value, ...args);
      };
      return [selectorName, hookifySelector(self, boundSelector)];
    }),
  ) as unknown as ParseHookSelectors<S>;
}

function hookifySelector<T, ET, R>(
  self: QuarkContext<T, ET>,
  select: (...args: any[]) => R,
) {
  const subscribe = (callback: () => void) => {
    self.subscribers.add(callback);
    return () => self.subscribers.delete(callback);
  };

  return (...args: any[]) => {
    return useSyncExternalStore(subscribe, () => select(...args));
  };
}
