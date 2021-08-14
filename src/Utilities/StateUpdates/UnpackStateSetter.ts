import type { QuarkContext, StateSetter } from "../../Types";
import { applyMiddlewares } from "../ApplyMiddlewares";
import { isGenerator } from "../IsGenerator";
import type { AsyncUpdateController } from "./AsyncUpdates";

export type UnpackStateSetterResult<T> = {
  then(handler: (state: T) => void): void;
};

export function unpackStateSetter<T, A, TE>(
  self: QuarkContext<T, A, TE>,
  asyncUpdates: AsyncUpdateController<T>,
  setter: StateSetter<T, never>
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
    const state = setter(self.value);
    return {
      then(handler: (state: T) => void) {
        applyMiddlewares(self, state, "sync", (v) => {
          unpackStateSetter(self, asyncUpdates, v).then(handler);
        });
      },
    };
  }

  asyncUpdates.preventLastAsyncUpdate();

  return {
    then(handler: (state: T) => void) {
      handler(setter);
    },
  };
}
