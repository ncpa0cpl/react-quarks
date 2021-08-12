import { applyMiddlewares } from "../ApplyMiddlewares";
import { isGenerator } from "../IsGenerator";
export function unpackStateSetter(self, asyncUpdates, setter) {
    if (setter instanceof Promise) {
        return {
            then(handler) {
                asyncUpdates.dispatchAsyncUpdate(setter, (state) => {
                    applyMiddlewares(self, state, "async", (v) => unpackStateSetter(self, asyncUpdates, v).then(handler));
                });
            },
        };
    }
    asyncUpdates.preventLastAsyncUpdate();
    if (isGenerator(setter)) {
        const state = setter(self.value);
        return {
            then(handler) {
                handler(state);
            },
        };
    }
    return {
        then(handler) {
            handler(setter);
        },
    };
}
