"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCustomActions = void 0;
const CancelUpdate_1 = require("./CancelUpdate");
const PropagateError_1 = require("./PropagateError");
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
function generateCustomActions(self, setState, actions) {
    return Object.fromEntries(Object.entries(actions).map(([actionName, actionMethod]) => {
        // @ts-expect-error
        actionMethod = actionMethod.bind(actions);
        const wrappedAction = (...args) => {
            let newState;
            try {
                newState = actionMethod(self.value, ...args);
                return setState(newState);
            }
            catch (e) {
                if (CancelUpdate_1.CancelUpdate.isCancel(e)) {
                    return;
                }
                if (!(newState instanceof Promise)) {
                    const err = (0, PropagateError_1.propagateError)(e, "State update was unsuccessful due to an error.");
                    console.error(err);
                }
                throw e;
            }
        };
        return [actionName, wrappedAction];
    }));
}
exports.generateCustomActions = generateCustomActions;
