import { QuarkContext, SetStateAction } from "../../Types/Quark";
import { CancelUpdate } from "../CancelUpdate";
import { isGenerator } from "../IsGenerator";
import { applyMiddlewares } from "./ApplyMiddlewares";
import { AtomicUpdater } from "./AsyncUpdates";
import { resolveUpdateType } from "./ResolveUpdateType";

/**
 * @internal
 */
export type UnpackStateSetterResult<T> = {
  then(handler: (state: T) => void): void | Promise<void>;
};

const thenableNoop = { then() {} };

/**
 * If the provided value is a Promise or a State Generator, resolve it and the
 * pass the received value to the middlewares and then "unpack" it again.
 *
 * If the provided value is of any other type, signal the async controller to
 * cancel ongoing updates and resolve the function passed to the `then()` method
 * with the value.
 *
 * @param self Quark context
 * @param asyncUpdates Asynchronous updates controller
 * @param setter Value dispatched as an update to be unpacked
 * @internal
 */
export function unpackStateSetter<T, ET>(
  self: QuarkContext<T, ET>,
  updater: AtomicUpdater<T>,
  setter: SetStateAction<T, ET>,
): UnpackStateSetterResult<T> {
  if (setter instanceof Promise) {
    return {
      then(handler: (state: T) => void) {
        return setter
          .then((state) => {
            const type = resolveUpdateType(state);
            return applyMiddlewares(
              self,
              state,
              type,
              updater,
              (v) => unpackStateSetter(self, updater, v).then(handler),
            );
          })
          .catch((err) => {
            if (CancelUpdate.isCancel(err)) {
              updater.cancel();
              return;
            }
            throw err;
          });
      },
    };
  }

  if (isGenerator<T>(setter)) {
    try {
      const s = setter(self.value);

      return {
        then(handler: (state: T) => void) {
          const type = resolveUpdateType(s);
          return applyMiddlewares<T, ET, any>(
            self,
            s,
            type,
            updater,
            (v) => unpackStateSetter(self, updater, v).then(handler),
          );
        },
      };
    } catch (err) {
      if (CancelUpdate.isCancel(err)) {
        updater.cancel();
        return thenableNoop;
      }
      throw err;
    }
  }

  return {
    then(handler: (state: T) => void) {
      return handler(setter as T);
    },
  };
}

export function unpackStateSetterSync<T, ET>(
  self: QuarkContext<T, ET>,
  updater: AtomicUpdater<T>,
  setter: SetStateAction<T, ET>,
): UnpackStateSetterResult<T> {
  if (isGenerator<T>(setter)) {
    const s = setter(self.value);

    return {
      then(handler: (state: T) => void) {
        const type = resolveUpdateType(s);
        return applyMiddlewares<T, ET, any>(
          self,
          s,
          type,
          updater,
          (v) => unpackStateSetterSync(self, updater, v).then(handler),
        );
      },
    };
  }

  return {
    then(handler: (state: T) => void) {
      return handler(setter as T);
    },
  };
}
