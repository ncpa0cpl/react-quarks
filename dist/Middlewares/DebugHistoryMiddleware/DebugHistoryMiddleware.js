"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDebugHistoryMiddleware = void 0;
const lodash_1 = require("lodash");
const UpdateHistory_1 = require("./UpdateHistory");
function getValueType(val) {
    if (val instanceof Promise)
        return "Promise";
    if (typeof val === "function")
        return "Generator";
    return "Value";
}
function cloneDeep(v) {
    if (v instanceof Promise || typeof v === "function")
        return v;
    return (0, lodash_1.cloneDeep)(v);
}
function createDebugHistoryMiddleware(options) {
    const { name, trace = true, realTimeLogging = false, useTablePrint = true, } = options;
    const StateUpdateHistory = (0, UpdateHistory_1.getStateUpdateHistory)();
    const quarkHistoryTracker = StateUpdateHistory.track({
        name,
        realTimeLogging,
        useTablePrint,
    });
    return (getState, newValue, resume, _, type) => {
        switch (type) {
            case "sync": {
                const stackTrace = trace
                    ? new Error().stack?.replace(/$Error\n\sat/gi, "Called from")
                    : undefined;
                quarkHistoryTracker.addHistoryEntry({
                    source: "Sync-Dispatch",
                    stackTrace,
                    initialState: {
                        type: "Value",
                        value: cloneDeep(getState()),
                    },
                    dispatchedUpdate: {
                        type: getValueType(newValue),
                        value: cloneDeep(newValue),
                    },
                });
                break;
            }
            case "async": {
                quarkHistoryTracker.addHistoryEntry({
                    source: "Async-Dispatch",
                    stackTrace: undefined,
                    initialState: {
                        type: "Value",
                        value: cloneDeep(getState()),
                    },
                    dispatchedUpdate: {
                        type: getValueType(newValue),
                        value: cloneDeep(newValue),
                    },
                });
                break;
            }
        }
        return resume(newValue);
    };
}
exports.createDebugHistoryMiddleware = createDebugHistoryMiddleware;
