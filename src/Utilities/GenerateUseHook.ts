import { useSyncExternalStore } from "use-sync-external-store/shim";
import type {
  DeepReadonly,
  ParseActions,
  QuarkContext,
  QuarkSetterFn,
} from "../Types";

/**
 * Generate the react hook for this specific quark.
 *
 * @param self Context of the Quark in question
 * @param set Function allowing for updating the current state of the Quark
 * @param get Function that resolves the Quark state value
 * @returns A React Hook function exposing this quark state and actions
 * @internal
 */
export function generateUseHook<T, A extends ParseActions<any>, ET>(
  self: QuarkContext<T, ET>,
  actions: A,
  set: QuarkSetterFn<T, ET>,
) {
  const subscribe = (callback: () => void) => {
    self.subscribers.add(callback);
    return () => void self.subscribers.delete(callback);
  };

  const getSnapshot = () => self.value;

  return () => {
    const value = useSyncExternalStore(
      subscribe,
      getSnapshot,
    ) as DeepReadonly<T>;

    return {
      set: set as any,
      value,
      ...actions,
    };
  };
}
