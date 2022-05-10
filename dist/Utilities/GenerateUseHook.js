"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUseHook = void 0;
const shim_1 = require("use-sync-external-store/shim");
/**
 * Generate the react hook for this specific quark.
 *
 * @param self Context of the Quark in question
 * @param set Function allowing for updating the current state of the Quark
 * @param get Function that resolves the Quark state value
 * @returns A React Hook function exposing this quark state and actions
 * @internal
 */
function generateUseHook(self, actions, set) {
    const subscribe = (callback) => {
        self.subscribers.add(callback);
        return () => void self.subscribers.delete(callback);
    };
    const getSnapshot = () => self.value;
    return () => {
        const value = (0, shim_1.useSyncExternalStore)(subscribe, getSnapshot);
        return {
            set,
            value,
            ...actions,
        };
    };
}
exports.generateUseHook = generateUseHook;
