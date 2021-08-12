import { cloneDeep as _cloneDeep } from "lodash";
import { StateUpdateHistory } from "./UpdateHistory";
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
    return _cloneDeep(v);
}
export function createDebugHistoryMiddleware(options) {
    const { name, trace = true } = options;
    const quarkHistoryTracker = StateUpdateHistory.track(name);
    return (getState, newValue, resume, _, type) => {
        switch (type) {
            case "sync": {
                const stackTrace = trace
                    ? new Error().stack?.replace(/$Error\n at/, "Called from")
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
