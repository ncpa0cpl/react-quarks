/**
 * @internal
 */
export function generateCustomActions(self, setState, actions) {
    return Object.fromEntries(Object.entries(actions).map(([actionName, actionMethod]) => {
        const wrappedAction = (...args) => {
            const newState = actionMethod(self.value, ...args);
            setState(newState);
        };
        return [actionName, wrappedAction];
    }));
}
