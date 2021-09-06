/**
 * Run all the necessary action after the state has changed, propagate the effects
 * and send events to the subscribers if necessary.
 *
 * @internal
 */
export function processStateUpdate(params) {
    const { omitNotifyingSubscribers, previousState, self, updateStateWithMiddlewares, } = params;
    const shouldUpdate = self.stateComparator(self.value, previousState);
    const propagateSideEffects = () => {
        const set = (value) => {
            updateStateWithMiddlewares(value, !(value instanceof Promise));
        };
        for (const sideEffect of self.effects) {
            sideEffect(previousState, self.value, set);
        }
    };
    const notifySubscribers = () => {
        for (const subscriber of self.subscribers) {
            subscriber(self.value);
        }
    };
    if (shouldUpdate) {
        propagateSideEffects();
        if (!omitNotifyingSubscribers)
            notifySubscribers();
    }
}
