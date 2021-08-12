import { applyMiddlewares } from "../ApplyMiddlewares";
import { asyncUpdatesController } from "./AsyncUpdates";
import { processStateUpdate } from "./ProcessStateUpdate";
import { unpackStateSetter } from "./UnpackStateSetter";
/** @internal */
export function generateSetter(self) {
    const asyncUpdates = asyncUpdatesController();
    const updateState = (setter, __internal_omit_render = false) => {
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
    const applyMiddlewaresAndUpdateState = (newVal, __internal_omit_render = false) => {
        applyMiddlewares(self, newVal, "sync", (v) => updateState(v, __internal_omit_render));
    };
    return {
        applyMiddlewaresAndUpdateState,
        updateState,
    };
}
