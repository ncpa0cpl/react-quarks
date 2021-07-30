import { generateCustomActions } from "./Utilities/GenerateCustomActions";
import { generateCustomSelectors } from "./Utilities/GenerateCustomSelectros";
import { generateSelectHook } from "./Utilities/GenerateSelectHook";
import { generateSetter } from "./Utilities/GenerateSetter";
import { generateUseHook } from "./Utilities/GenerateUseHook";
import { initiateEffects } from "./Utilities/InitiateEffects";
import { isUpdateNecessary } from "./Utilities/IsUpdateNecessary";
export function quark(initValue, config = {}, effects) {
    const self = {
        value: initValue,
        effects: new Set(),
        subscribers: new Set(),
        customActions: undefined,
        stateComparator: config.shouldUpdate ?? isUpdateNecessary,
    };
    const set = generateSetter(self);
    const customActions = generateCustomActions(self, set, config?.actions ?? {});
    self.customActions = customActions;
    const customSelectors = generateCustomSelectors(self, config?.selectors ?? {});
    const get = () => self.value;
    const use = generateUseHook(self, set, get);
    const useSelector = generateSelectHook(self);
    initiateEffects(self, effects ?? {});
    return {
        get,
        set,
        use,
        useSelector,
        ...customActions,
        ...customSelectors,
    };
}
