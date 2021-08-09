import React from "react";
/** @internal */
function generateCustomSelectHook(self, selector) {
    return (shouldComponentUpdate) => {
        const [, forceRender] = React.useReducer((s) => s + 1, 0);
        const initVal = React.useMemo(() => selector(self.value), []);
        const selectedValue = React.useRef(initVal);
        const get = () => selectedValue.current;
        React.useEffect(() => {
            const stateComparator = shouldComponentUpdate ?? ((a, b) => !Object.is(a, b));
            const onValueChange = (newVal) => {
                const sv = selector(newVal);
                if (stateComparator(sv, selectedValue.current)) {
                    selectedValue.current = sv;
                    forceRender();
                }
            };
            self.subscribers.add(onValueChange);
            return () => {
                self.subscribers.delete(onValueChange);
            };
        }, [shouldComponentUpdate]);
        return {
            get,
        };
    };
}
/** @internal */
export function generateCustomSelectors(self, selectors) {
    return Object.fromEntries(Object.entries(selectors).map(([selectorName, selectorMethod]) => {
        const wrappedSelector = generateCustomSelectHook(self, selectorMethod);
        return [selectorName, wrappedSelector];
    }));
}
