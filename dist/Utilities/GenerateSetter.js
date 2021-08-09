import { applyMiddlewares } from "./ApplyMiddlewares";
import { isGenerator } from "./IsGenerator";
/** @internal */
export function generateSetter(self) {
    const rawSetter = (newVal, __internal_omit_render = false) => {
        const newState = isGenerator(newVal) ? newVal(self.value) : newVal;
        const previousState = self.value;
        const shouldForceRender = self.stateComparator(self.value, newState);
        self.value = newState;
        if (shouldForceRender) {
            self.effects.forEach((e) => e(previousState, newState, {
                ...self.customActions,
                set: (v) => rawSetter(v, true),
            }));
            if (!__internal_omit_render)
                self.subscribers.forEach((s) => s(self.value));
        }
    };
    const setterWithMiddlewares = (newVal) => {
        applyMiddlewares(self, newVal, rawSetter);
    };
    return { setterWithMiddlewares, rawSetter };
}
