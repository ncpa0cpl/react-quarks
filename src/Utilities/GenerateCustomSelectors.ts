import React from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";
import { QuarkContext, Selects } from "../Types/Quark";
import { QuarkSelector, QuarkSelectors } from "../Types/Selectors";
import {
  createBasicCachedSelector,
  createCachedSelector,
} from "./CreateCachedSelector";

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
): Selects<T, S> {
  const base = selectors
    .map(([selectorName, selectorMethod]) => {
      return [
        selectorName,
        (...args: any[]) => selectorMethod(self.value, ...args),
      ];
    });

  const hooks = selectors.map(([selectorName, selector]) => {
    return [
      "use" + capitalize(selectorName as string),
      hookifySelector(self, selector),
    ];
  });

  return Object.fromEntries(
    base
      .concat(hooks)
      .concat([["$", (selectFn: Function) => selectFn(self.value)]])
      .concat([["use", createStandaloneSelectorHook(self)]]),
  ) as unknown as Selects<T, S>;
}

function createStandaloneSelectorHook<T, ET>(self: QuarkContext<T, ET>) {
  return <ARGS extends any[], R>(
    selector: QuarkSelector<T, ARGS, R>,
    ...args: ARGS
  ) => {
    const [cachedSelector] = React.useState(() =>
      createCachedSelector(selector)
    );

    return useSyncExternalStore(
      self.syncStoreSubscribe,
      () => cachedSelector(self.value, ...args),
    );
  };
}

function hookifySelector<T, ET, R>(
  self: QuarkContext<T, ET>,
  selector: (state: T, ...args: any[]) => R,
) {
  const initCachedSelector = () => createBasicCachedSelector(selector);

  return (...args: any[]) => {
    const [select] = React.useState(initCachedSelector);
    return useSyncExternalStore(
      self.syncStoreSubscribe,
      () => select(self.value, ...args),
    );
  };
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
