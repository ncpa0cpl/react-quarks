import type { QuarkContext, SetStateAction } from "../../Types";
import { applyMiddlewares } from "./ApplyMiddlewares";
import { asyncUpdatesController } from "./AsyncUpdates";
import { createEventsDebouncer as createEventDebouncer } from "./EventsDispatcher";
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
export function generateSetter<T, ET>(self: QuarkContext<T, ET>) {
  const asyncUpdates = asyncUpdatesController<T, ET>(self);
  const { debounceEvent } = createEventDebouncer();

  /**
   * A method for updating the Quark state, this method can take as it's argument the
   * new state value, a generator function or a Promise resolving to the new value.
   */
  const set = (action: SetStateAction<T, ET>): void => {
    return applyMiddlewares(self, action, "sync", (action2) =>
      unpackStateSetter(self, asyncUpdates, action2).then((newState) => {
        const previousState = self.value;
        self.value = newState;

        return processStateUpdate({
          self,
          previousState,
          applyMiddlewaresAndUpdateState: set,
          debounceEvent,
        });
      })
    );
  };

  const bareboneSet = (action: SetStateAction<T, ET>): void => {
    unpackStateSetter(self, asyncUpdates, action).then((newState) => {
      self.value = newState;
    });
  };

  return {
    /**
     * Applies middlewares, unpacks the action, assigns the new state and informs the
     * subscribers of the quark.
     */
    set,
    /**
     * Same as `set` but does not apply middlewares or inform the quark subscribents
     * of the state change.
     */
    bareboneSet,
  };
}
