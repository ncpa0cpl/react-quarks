import type { QuarkContext, StateSetter } from "../../Types";
import { applyMiddlewares } from "../ApplyMiddlewares";
import { asyncUpdatesController } from "./AsyncUpdates";
import { processStateUpdate } from "./ProcessStateUpdate";
import { unpackStateSetter } from "./UnpackStateSetter";

/** @internal */
export function generateSetter<T, A, ET>(self: QuarkContext<T, A, ET>) {
  const asyncUpdates = asyncUpdatesController<T>(self);

  const updateState = (
    setter: StateSetter<T, never>,
    __internal_omit_render = false
  ) => {
    unpackStateSetter(self, asyncUpdates, setter).then((newState) => {
      const previousState = self.value;
      self.value = newState;

      processStateUpdate({
        self,
        previousState,
        omitNotifyingSubscribers: __internal_omit_render,
        updateStateWithMiddlewares: (v) => applyMiddlewaresAndUpdateState(v, true),
      });
    });
  };

  const applyMiddlewaresAndUpdateState = (
    newVal: StateSetter<T, ET>,
    __internal_omit_render = false
  ) => {
    applyMiddlewares(self, newVal, "sync", (v) =>
      updateState(v, __internal_omit_render)
    );
  };

  return applyMiddlewaresAndUpdateState;
}
