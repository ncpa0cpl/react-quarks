import { applyMiddlewares } from "./ApplyMiddlewares";
import { createCancelableMethod } from "./CancelableMethod";
import { isGenerator } from "./IsGenerator";
/** @internal */
export function generateSetter(self) {
    const asyncUpdates = [];
    const cancelPreviousUpdates = () => {
        while (asyncUpdates.length > 0) {
            const cancel = asyncUpdates.pop();
            if (cancel)
                cancel();
        }
    };
    const rawSetter = (newState, __internal_omit_render = false) => {
        const previousState = self.value;
        const shouldForceRender = self.stateComparator(self.value, newState);
        self.value = newState;
        if (shouldForceRender) {
            self.effects.forEach((e) => e(previousState, newState, {
                ...self.customActions,
                set: (v) => setterWithMiddlewares(v, true),
            }));
            if (!__internal_omit_render)
                self.subscribers.forEach((s) => s(self.value));
        }
    };
    const setterWithMiddlewares = (newVal, __internal_omit_render = false) => {
        cancelPreviousUpdates();
        const newState = isGenerator(newVal) ? newVal(self.value) : newVal;
        if (newState instanceof Promise) {
            const [onPromiseFinish, cancel] = createCancelableMethod((v) => {
                applyMiddlewares(self, v, (v) => rawSetter(v, __internal_omit_render));
            });
            asyncUpdates.push(cancel);
            newState.then(onPromiseFinish).catch((e) => {
                console.error(e);
            });
        }
        else {
            applyMiddlewares(self, newVal, (v) => rawSetter(v, __internal_omit_render));
        }
    };
    return { setterWithMiddlewares, rawSetter };
}
