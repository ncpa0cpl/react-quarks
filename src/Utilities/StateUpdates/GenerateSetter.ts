import { QuarkContext, SetStateAction } from "../../Types/Quark";
import { CancelUpdate } from "../CancelUpdate";
import { createAssign } from "../CreateAssign";
import { setWithMiddlewares } from "./ApplyMiddlewares";
import { Immediate } from "./Immediate";

/**
 * Generates a function that allows for updating the state of the Quark.
 *
 * Updating the state with this function will trigger the Quark middlewares.
 *
 * @param self Quark context
 * @returns A method for updating the Quark state, this method can take as it's
 *   argument the new state value, a generator function or a Promise resolving
 *   to the new value.
 * @internal
 */
export function generateSetter<T>(self: QuarkContext<T>) {
  const onErr = (e: unknown) => {
    if (CancelUpdate.isCancel(e)) {
      return undefined;
    }
    throw e;
  };

  /**
   * A method for updating the Quark state, this method can take as it's
   * argument the new state value, a generator function or a Promise resolving
   * to the new value.
   */
  const set = (action: SetStateAction<T>) => {
    return self.updateController.atomicUpdate(updater => {
      const result = setWithMiddlewares(self, action, updater)
        .catch(onErr)
        .finally(() => {
          updater.complete();
        });

      if (result instanceof Immediate) {
        return Immediate.unpack(result);
      }

      return result;
    });
  };

  /**
   * A method for updating the Quark state, this method can take as it's
   * argument the new state value, a generator function or a Promise resolving
   * to the new value.
   */
  const assign = createAssign(set);
  //   (...args: [Partial<T>] | [(v: T) => any, any]) => {
  //   if (args.length === 2) {
  //     const [selector, patch] = args;
  //     return set((state) => {
  //       if (isDraft(state)) {
  //         const s = selector(state);
  //         Object.assign(s, patch);
  //         return state;
  //       }

  //       const newValue = produce(state, draft => {
  //         const s = selector(draft as T);
  //         Object.assign(s, patch);
  //       });
  //       return newValue;
  //     });
  //   }

  //   const [patch] = args;
  //   return set((state) => {
  //     if (isDraft(state)) {
  //       Object.assign(state as object, patch);
  //       return state;
  //     }
  //     return Object.assign({ ...state as object }, patch) as T;
  //   });
  // };

  const unsafeSet = (action: T | ((current: T) => T)) => {
    return self.updateController.unsafeUpdate(updater => {
      const result = setWithMiddlewares(self, action, updater)
        .catch(onErr)
        .finally(() => {
          updater.complete();
        });

      if (result instanceof Immediate) {
        return Immediate.unpack(result);
      }

      return result;
    });
  };

  return {
    set,
    assign,
    unsafeSet,
  };
}
