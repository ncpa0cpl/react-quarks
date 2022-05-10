"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useDynamicDependencies = void 0;
const react_1 = __importDefault(require("react"));
const useDynamicDependencies = (deps) => {
    const lastDepResult = react_1.default.useRef(0);
    const prevDeps = react_1.default.useRef(deps);
    if (deps.length !== prevDeps.current.length) {
        lastDepResult.current = (lastDepResult.current + 1) % 1000;
    }
    else if (deps.some((elem, index) => !Object.is(elem, prevDeps.current[index]))) {
        lastDepResult.current = (lastDepResult.current + 1) % 1000;
    }
    prevDeps.current = deps;
    return lastDepResult.current;
};
exports.useDynamicDependencies = useDynamicDependencies;
