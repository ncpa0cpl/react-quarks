import React from "react";
/**
 * Generate a 'selector' React Hook for this Quark.
 *
 * Selector hook allows for selecting part of the state and subscribing to it's changes.
 *
 * @param self Context of the Quark in question
 * @internal
 */
export function generateSelectHook(self) {
    return (selector, ...args) => {
        const [, forceRender] = React.useReducer((s) => s + 1, 0);
        const [initVal] = React.useState(() => selector(self.value, ...args));
        const selectedValue = React.useRef(initVal);
        const get = () => selectedValue.current;
        React.useEffect(() => {
            const onValueChange = (newVal) => {
                const sv = selector(newVal, ...args);
                if (!Object.is(sv, selectedValue.current)) {
                    selectedValue.current = sv;
                    forceRender();
                }
            };
            onValueChange(self.value);
            self.subscribers.add(onValueChange);
            return () => {
                self.subscribers.delete(onValueChange);
            };
        }, [selector, ...args]);
        return {
            get,
        };
    };
}
