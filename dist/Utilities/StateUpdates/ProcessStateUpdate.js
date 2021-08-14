export function processStateUpdate(params) {
    const { omitNotifyingSubscribers, previousState, self, updateStateWithMiddlewares, } = params;
    const shouldUpdate = self.stateComparator(self.value, previousState);
    const propagateSideEffects = () => {
        const actions = {
            ...self.customActions,
            set: updateStateWithMiddlewares,
        };
        for (const sideEffect of self.effects) {
            sideEffect(previousState, self.value, actions);
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
