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
    const set = (0, Utilities_1.generateSetter)(self);
    const customActions = (0, Utilities_1.generateCustomActions)(self, set, config?.actions ?? {});
    const customSelectors = (0, Utilities_1.generateCustomSelectors)(self, config?.selectors ?? {});
    const get = () => self.value;
    const use = (0, Utilities_1.generateUseHook)(self, customActions, set, get);
    const useSelector = (0, Utilities_1.generateSelectHook)(self);
    const subscribe = (0, GenerateSubscribeFunction_1.generateSubscribeFunction)(self);
    const quark = {
        get,
        set,
        use,
        useSelector,
        subscribe,
        ...customActions,
        ...customSelectors,
    };
    return quark;
}
exports.quark = quark;
