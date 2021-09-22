"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processStateUpdate = void 0;
/**
 * Run all the necessary action after the state has changed, propagate the effects
 * and send events to the subscribers if necessary.
 *
 * @internal
 */
function processStateUpdate(params) {
    const { previousState, self, applyMiddlewaresAndUpdateState, dispatchEvent } = params;
    const shouldUpdate = self.stateComparator(self.value, previousState);
    const subscribers = new Set(self.subscribers);
    const notifySubscribers = () => {
        for (const subscriber of subscribers) {
            subscriber(self.value);
        }
    };
    if (shouldUpdate) {
        if (self.sideEffect) {
            self.sideEffect(previousState, self.value, applyMiddlewaresAndUpdateState);
        }
        dispatchEvent(() => {
            notifySubscribers();
        });
    }
}
exports.processStateUpdate = processStateUpdate;
