import type { QuarkContext, StateSetter } from "../../Types";
import { applyMiddlewares } from "./ApplyMiddlewares";
import { asyncUpdatesController } from "./AsyncUpdates";
import { processStateUpdate } from "./ProcessStateUpdate";
import { unpackStateSetter } from "./UnpackStateSetter";

/**
 * Generates a function that allows for updating the state of the Quark.
 *
 * Updating the state with this function will trigger the Quark middlewares.
 *
 * @param self Quark context
 * @returns A method for updating the Quark state, this method can take as it's
 *   argument the new state value, a generator function or a Promise resolving to the
 *   new value.
 * @internal
 */
export function generateSetter<T, A, ET>(self: QuarkContext<T, A, ET>) {
  const asyncUpdates = asyncUpdatesController<T>(self);

  /**
   * A method for updating the Quark state, this method can take as it's argument the
   * new state value, a generator function or a Promise resolving to the new value.
   */
  const applyMiddlewaresAndUpdateState = (
    newVal: StateSetter<T, ET>,
    __internal_omit_render = false
  ) => {
    applyMiddlewares(self, newVal, "sync", (setter) =>
      unpackStateSetter(self, asyncUpdates, setter).then((newState) => {
        const previousState = self.value;
        self.value = newState;

        processStateUpdate({
          self,
          previousState,
          omitNotifyingSubscribers: __internal_omit_render,
          updateStateWithMiddlewares: (v) => applyMiddlewaresAndUpdateState(v, true),
        });
      })
    );
  };

  return applyMiddlewaresAndUpdateState;
}
