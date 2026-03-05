import { useMemo } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";
import { ParseActions } from "../Types/Actions";
import {
  DeepReadonly,
  QuarkAssignFn,
  QuarkContext,
  QuarkHook,
  QuarkSetterFn,
} from "../Types/Quark";

/**
 * Generate the react hook for this specific quark.
 *
 * @param self Context of the Quark in question
 * @param set Function allowing for updating the current state of the Quark
 * @param get Function that resolves the Quark state value
 * @returns A React Hook function exposing this quark state and actions
 * @internal
 */
export function generateUseHook<T, A>(
  self: QuarkContext<T>,
  actions: ParseActions<A>,
  set: QuarkSetterFn<T>,
  assign: QuarkAssignFn<T>,
  unsafeSet: (newValue: T) => void,
): () => QuarkHook<T, A> {
  const getSnapshot = () => self.value;

  return () => {
    const value = useSyncExternalStore(
      self.syncStoreSubscribe,
      getSnapshot,
    ) as DeepReadonly<T>;

    return useMemo(() => ({
      set: set as any,
      assign: assign as any,
      unsafeSet,
      value,
      ...actions,
    }), [value]);
  };
}
