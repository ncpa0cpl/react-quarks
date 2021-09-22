"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quark = void 0;
const Utilities_1 = require("./Utilities");
const GenerateSubscribeFunction_1 = require("./Utilities/GenerateSubscribeFunction");
/**
 * Creates a new quark object.
 *
 * @param initValue Initial data of the quark.
 * @param config Config allows for adding custom actions and selectors to the quark
 *   as well as changing when subscribed component should update.
 * @param effects Allows for adding side effects to the quark, those effects will be
 *   performed after any change to the quark state. Effects take three arguments,
 *
 *   - [`arg_0`] - previous state
 *   - [`arg_1`] - new/current state
 *   - [`arg_2`] - all of the actions of the quark (including `set()`)
 */
function quark(initValue, config = {}) {
    const self = {
        value: initValue,
        subscribers: new Set(),
        middlewares: config.middlewares ?? [],
        sideEffect: config.effect,
        stateComparator: config.shouldUpdate ?? Utilities_1.isUpdateNecessary,
        configOptions: {
            allowRaceConditions: config.allowRaceConditions ?? false,
        },
    };
    const setState = Utilities_1.generateSetter(self);
    const customActions = Utilities_1.generateCustomActions(self, setState, config?.actions ?? {});
    const customSelectors = Utilities_1.generateCustomSelectors(self, config?.selectors ?? {});
    const get = () => self.value;
    const use = Utilities_1.generateUseHook(self, customActions, setState, get);
    const useSelector = Utilities_1.generateSelectHook(self);
    const subscribe = GenerateSubscribeFunction_1.generateSubscribeFunction(self);
    return {
        get,
        set: setState,
        use,
        useSelector,
        subscribe,
        ...customActions,
        ...customSelectors,
    };
}
exports.quark = quark;
