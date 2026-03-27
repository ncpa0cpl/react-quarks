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
