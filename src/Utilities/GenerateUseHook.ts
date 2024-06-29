import { useSyncExternalStore } from "use-sync-external-store/shim";
import { ParseActions } from "../Types/Actions";
import { ParseProcedures } from "../Types/Procedures";
import {
  DeepReadonly,
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
export function generateUseHook<T, A, P, M extends any[], ET>(
  self: QuarkContext<T, ET>,
  actions: ParseActions<A>,
  procedures: ParseProcedures<P>,
  set: QuarkSetterFn<T, ET>,
  unsafeSet: (newValue: T) => void,
): () => QuarkHook<T, A, P, M> {
  const getSnapshot = () => self.value;

  return () => {
    const value = useSyncExternalStore(
      self.syncStoreSubscribe,
      getSnapshot,
    ) as DeepReadonly<T>;

    return {
      set: set as any,
      unsafeSet,
      value,
      ...actions,
      ...procedures,
    };
  };
}
