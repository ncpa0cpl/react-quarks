/**
 * Generates 'action' function based on the actions defined in the Quark config.
 *
 * Each 'action' definition takes the Quark state value as it's first argument and
 * returns a new state value.
 *
 * @param self Context of the Quark in question
 * @param setState Function allowing for updating the current state of the Quark
 * @param actions Object containing 'action' definitions
 * @returns An object with the same structure as the `actions` argument
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
