"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSelectHook = void 0;
const react_1 = __importDefault(require("react"));
const shim_1 = require("use-sync-external-store/shim");
const UseDynamicDependencies_1 = require("./UseDynamicDependencies");
/**
 * Generate a 'selector' React Hook for this Quark.
 *
 * Selector hook allows for selecting part of the state and subscribing to it's changes.
 *
 * @param self Context of the Quark in question
 * @internal
 */
function generateSelectHook(self) {
    const subscribe = (callback) => {
        self.subscribers.add(callback);
        return () => self.subscribers.delete(callback);
    };
    return (selector, ...args) => {
        const argsDep = (0, UseDynamicDependencies_1.useDynamicDependencies)(args);
        const get = react_1.default.useCallback(() => selector(self.value, ...args), [argsDep, self.value, selector]);
        const value = (0, shim_1.useSyncExternalStore)(subscribe, get);
        return value;
    };
}
exports.generateSelectHook = generateSelectHook;
