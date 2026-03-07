import { QuarkContext, SetStateAction } from "../../Types/Quark";
import { isDispatchFn } from "../IsGenerator";
import { applyMiddlewares } from "./ApplyMiddlewares";
import { AtomicUpdate } from "./AsyncUpdates";
import { Immediate, Resolvable } from "./Immediate";
import { resolveUpdateType } from "./ResolveUpdateType";

/**
 * @internal
 */
export type Thenable<T> = {
  then<R>(cb: (v: T) => R): Thenable<R>;
};

/**
 * If the provided value is a Promise or a State Generator, resolve it and the
 * pass the received value to the middlewares and then "unpack" it again.
 *
 * If the provided value is of any other type, signal the async controller to
 * cancel ongoing updates and resolve the function passed to the `then()` method
 * with the value.
 *
 * @param self Quark context
 * @param updater Asynchronous updates controller
 * @param action Value dispatched as an update to be unpacked
 * @param onUnpack callback invoked immediately after the action is resolved
 * @internal
 */
export function unpackAction<T>(
  self: QuarkContext<T>,
  updater: AtomicUpdate<T>,
  action: SetStateAction<T>,
  onUnpack: (action: T) => T | void,
): Resolvable<T | void> {
  if (action instanceof Promise) {
    return action
      .then((state) => {
        const type = resolveUpdateType(state);
        return applyMiddlewares(
          self,
          state,
          type,
          updater,
          (v) => unpackAction(self, updater, v, onUnpack),
        );
      });
  }

  if (isDispatchFn<T>(action)) {
    return Immediate.from(() => {
      const s = action(self.value);

      const type = resolveUpdateType(s);
      return applyMiddlewares(
        self,
        s,
        type,
        updater,
        (v) => unpackAction(self, updater, v, onUnpack),
      );
    });
  }

  return Immediate.resolve(onUnpack(action as T) as T);
}

export function unpackActionSync<T>(
  self: QuarkContext<T>,
  updater: AtomicUpdate<T>,
  action: SetStateAction<T>,
  onUnpack: (action: T | void) => T | void,
): Resolvable<T> {
  if (isDispatchFn<T>(action)) {
    return Immediate.from(() => {
      const s = action(self.value);
      const type = resolveUpdateType(s);
      return applyMiddlewares(
        self,
        s,
        type,
        updater,
        (v) => unpackActionSync(self, updater, v, onUnpack),
      );
    });
  }

  return Immediate.resolve(onUnpack(action as T) as T);
}
