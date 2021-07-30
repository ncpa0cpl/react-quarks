import React from "react";
/**
 * @internal
 */
export function generateUseHook(self, set, get) {
    return () => {
        const [, forceRender] = React.useReducer((s) => s + 1, 0);
        React.useEffect(() => {
            const onValueChange = () => forceRender();
            self.subscribers.add(onValueChange);
            return () => {
                self.subscribers.delete(onValueChange);
            };
        }, []);
        return {
            get,
            set,
            ...(self.customActions ?? {}),
        };
    };
}
