import type { QuarkContext, StateSetter } from "../../Types";
import { isGenerator } from "../IsGenerator";
import type { AsyncUpdateController } from "./AsyncUpdates";

export function unpackStateSetter<T, A, TE>(
  self: QuarkContext<T, A, TE>,
  asyncUpdates: AsyncUpdateController<T>,
  setter: StateSetter<T, never>
) {
  if (setter instanceof Promise) {
    return {
      then(handler: (state: T) => void) {
        asyncUpdates.dispatchAsyncUpdate(setter, handler);
      },
    };
  }

  asyncUpdates.preventLastAsyncUpdate();

  if (isGenerator<T>(setter)) {
    const state = setter(self.value);
    return {
      then(handler: (state: T) => void) {
        handler(state);
      },
    };
  }

  return {
    then(handler: (state: T) => void) {
      handler(setter);
    },
  };
}
