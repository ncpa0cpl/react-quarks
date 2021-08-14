import React from "react";
/** @internal */
export function generateSelectHook(self) {
    return (selector, shouldComponentUpdate) => {
        const [, forceRender] = React.useReducer((s) => s + 1, 0);
        const initVal = React.useMemo(() => selector(self.value), []);
        const selectedValue = React.useRef(initVal);
        const get = () => selectedValue.current;
        React.useEffect(() => {
            const stateComparator = shouldComponentUpdate ?? ((a, b) => !Object.is(a, b));
            const sv = selector(self.value);
            if (stateComparator(sv, selectedValue.current)) {
                selectedValue.current = sv;
                forceRender();
            }
        }, [selector]);
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
        }, [selector, shouldComponentUpdate]);
        return {
            get,
        };
    };
}
