"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUseHook = void 0;
const react_1 = __importDefault(require("react"));
/**
 * Generate the react hook for this specific quark.
 *
 * @param self Context of the Quark in question
 * @param set Function allowing for updating the current state of the Quark
 * @param get Function that resolves the Quark state value
 * @returns A React Hook function exposing this quark state and actions
 * @internal
 */
function generateUseHook(self, actions, set, get) {
    return () => {
        const [, forceRender] = react_1.default.useReducer((s) => s + 1, 0);
        react_1.default.useEffect(() => {
            const context = {
                reRender() {
                    forceRender();
                },
            };
            const onValueChange = () => context.reRender();
            self.subscribers.add(onValueChange);
            return () => {
                context.reRender = () => { };
                self.subscribers.delete(onValueChange);
            };
        }, []);
        return {
            get,
            set,
            ...actions,
        };
    };
}
exports.generateUseHook = generateUseHook;
