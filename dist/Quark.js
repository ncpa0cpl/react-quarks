import { generateCustomActions, generateCustomSelectors, generateSelectHook, generateSetter, generateUseHook, initiateEffects, isUpdateNecessary, } from "./Utilities";
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
export function quark(initValue, config = {}, effects) {
    const self = {
        value: initValue,
        effects: new Set(),
        subscribers: new Set(),
        middlewares: config.middlewares ?? [],
        stateComparator: config.shouldUpdate ?? isUpdateNecessary,
        configOptions: {
            allowRaceConditions: config.allowRaceConditions ?? false,
        },
    };
    const setState = generateSetter(self);
    const customActions = generateCustomActions(self, setState, config?.actions ?? {});
    const customSelectors = generateCustomSelectors(self, config?.selectors ?? {});
    const get = () => self.value;
    const use = generateUseHook(self, customActions, setState, get);
    const useSelector = generateSelectHook(self);
    initiateEffects(self, effects ?? {});
    return {
        get,
        set: setState,
        use,
        useSelector,
        ...customActions,
        ...customSelectors,
    };
}
