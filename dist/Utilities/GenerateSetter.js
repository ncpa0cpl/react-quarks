import { isGenerator } from "./IsGenerator";
/**
 * @internal
 */
export function generateSetter(self) {
    const setter = (newVal, __internal_omit_render = false) => {
        const newState = isGenerator(newVal) ? newVal(self.value) : newVal;
        const previousState = self.value;
        const shouldForceRender = self.stateComparator(self.value, newState);
        self.value = newState;
        if (shouldForceRender) {
            self.effects.forEach((e) => e(previousState, newState, {
                ...self.customActions,
                set: (v) => setter(v, true),
            }));
            if (!__internal_omit_render)
                self.subscribers.forEach((s) => s(self.value));
        }
    };
    return setter;
}
