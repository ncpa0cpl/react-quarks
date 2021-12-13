import type { QuarkContext, SetStateAction } from "../../Types";
import { isGenerator } from "../IsGenerator";
import { applyMiddlewares } from "./ApplyMiddlewares";
import type { AsyncUpdateController } from "./AsyncUpdates";

/** @internal */
export type UnpackStateSetterResult<T> = {
  then(handler: (state: T) => void): void;
};

/**
 * If the provided value is a Promise or a State Generator, resolve it and the pass
 * the received value to the middlewares and then "unpack" it again.
 *
 * If the provided value is of any other type, signal the async controller to cancel
 * ongoing updates and resolve the function passed to the `then()` method with the value.
 *
 * @param self Quark context
 * @param asyncUpdates Asynchronous updates controller
 * @param setter Value dispatched as an update to be unpacked
 * @internal
 */
export function unpackStateSetter<T, ET>(
  self: QuarkContext<T, ET>,
  asyncUpdates: AsyncUpdateController<T, ET>,
  setter: SetStateAction<T, ET>
): UnpackStateSetterResult<T> {
  if (setter instanceof Promise) {
    return {
      then(handler: (state: T) => void) {
        asyncUpdates.dispatchAsyncUpdate(setter, (state) => {
          applyMiddlewares(self, state, "async", (v) =>
            unpackStateSetter(self, asyncUpdates, v).then(handler)
          );
        });
      },
    };
  }

  if (isGenerator<T>(setter)) {
    const s = setter(self.value);

    return {
      then(handler: (state: T) => void) {
        applyMiddlewares<T, ET>(self, s, "sync", (v) => {
          unpackStateSetter(self, asyncUpdates, v).then(handler);
        });
      },
    };
  }

  asyncUpdates.preventLastAsyncUpdate();

  return {
    then(handler: (state: T) => void) {
      handler(setter as T);
    },
  };
}
