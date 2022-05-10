import React from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";
import type { QuarkContext, QuarkSelector } from "../Types";
import { useDynamicDependencies } from "./UseDynamicDependencies";
/**
 * Generate a 'selector' React Hook for this Quark.
 *
 * Selector hook allows for selecting part of the state and subscribing to it's changes.
 *
 * @param self Context of the Quark in question
 * @internal
 */
export function generateSelectHook<T, ET>(self: QuarkContext<T, ET>) {
  const subscribe = (callback: () => void) => {
    self.subscribers.add(callback);
    return () => self.subscribers.delete(callback);
  };

  return <ARGS extends any[], R>(
    selector: QuarkSelector<T, ARGS, R>,
    ...args: ARGS
  ) => {
    const argsDep = useDynamicDependencies(args);

    const get = React.useCallback(
      () => selector(self.value, ...args),
      [argsDep, self.value, selector]
    );

    const value = useSyncExternalStore(subscribe, get);

    return value;
  };
}
