import React from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";
import type {
  ParseHookSelectors,
  QuarkContext,
  QuarkSelector,
  QuarkSelectors,
} from "../Types";
import { createCachedSelector } from "./CreateCachedSelector";

function createStandaloneSelectorHook<T, ET>(self: QuarkContext<T, ET>) {
  const subscribe = (callback: () => void) => {
    self.subscribers.add(callback);
    return () => self.subscribers.delete(callback);
  };

  return <ARGS extends any[], R>(
    selector: QuarkSelector<T, ARGS, R>,
    ...args: ARGS
  ) => {
    const [cachedSelector] = React.useState(() =>
      createCachedSelector(selector)
    );

    return useSyncExternalStore(
      subscribe,
      () => cachedSelector(self.value, ...args),
    );
  };
}

/**
 * Generate a 'selector' React Hook for this Quark.
 *
 * Selector hook allows for selecting part of the state and subscribing to it's
 * changes.
 *
 * @param self Context of the Quark in question
 * @internal
 */
export function generateSelectorHooks<T, ET, S extends QuarkSelectors<T, any>>(
  self: QuarkContext<T, ET>,
  hookSelectors: ParseHookSelectors<S>,
) {
  return {
    $: createStandaloneSelectorHook(self),
    ...hookSelectors,
  };
}
