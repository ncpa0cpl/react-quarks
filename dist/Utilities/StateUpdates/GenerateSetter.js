"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSetter = void 0;
const ApplyMiddlewares_1 = require("./ApplyMiddlewares");
const AsyncUpdates_1 = require("./AsyncUpdates");
const EventsDispatcher_1 = require("./EventsDispatcher");
const ProcessStateUpdate_1 = require("./ProcessStateUpdate");
const UnpackStateSetter_1 = require("./UnpackStateSetter");
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
function generateSetter(self) {
    const asyncUpdates = AsyncUpdates_1.asyncUpdatesController(self);
    const { dispatchEvent } = EventsDispatcher_1.createEventsDispatcher();
    /**
     * A method for updating the Quark state, this method can take as it's argument the
     * new state value, a generator function or a Promise resolving to the new value.
     */
    const applyMiddlewaresAndUpdateState = (newVal) => {
        ApplyMiddlewares_1.applyMiddlewares(self, newVal, "sync", (setter) => UnpackStateSetter_1.unpackStateSetter(self, asyncUpdates, setter).then((newState) => {
            const previousState = self.value;
            self.value = newState;
            ProcessStateUpdate_1.processStateUpdate({
                self,
                previousState,
                applyMiddlewaresAndUpdateState,
                dispatchEvent,
            });
        }));
    };
    return applyMiddlewaresAndUpdateState;
}
exports.generateSetter = generateSetter;
