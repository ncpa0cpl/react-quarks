"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSelectHook = void 0;
const react_1 = __importDefault(require("react"));
/**
 * Generate a 'selector' React Hook for this Quark.
 *
 * Selector hook allows for selecting part of the state and subscribing to it's changes.
 *
 * @param self Context of the Quark in question
 * @internal
 */
function generateSelectHook(self) {
    return (selector, ...args) => {
        const [, forceRender] = react_1.default.useReducer((s) => s + 1, 0);
        const [initVal] = react_1.default.useState(() => selector(self.value, ...args));
        const selectedValue = react_1.default.useRef(initVal);
        const get = () => selectedValue.current;
        react_1.default.useEffect(() => {
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
exports.generateSelectHook = generateSelectHook;
