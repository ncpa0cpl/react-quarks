import { extractIsPromiseCanceled } from "../../Utilities/StateUpdates/AsyncUpdates";
import { StateUpdateHistory } from "./UpdateHistory";
export function createDebugHistoryMiddleware(options) {
    const { name, trace = true } = options;
    const quarkHistoryTracker = StateUpdateHistory.track(name);
    return (getState, newValue, resume) => {
        const stackTrace = trace ? new Error().stack : undefined;
        quarkHistoryTracker.addHistoryEntry({
            source: "Set-Dispatch",
            stackTrace,
            initialState: {
                value: getState(),
                type: "Value",
            },
            dispatchedUpdate: {
                value: newValue,
                type: newValue instanceof Promise
                    ? "Promise"
                    : typeof newValue === "function"
                        ? "Generator"
                        : "Value",
            },
        });
        if (newValue instanceof Promise) {
            newValue.then((result) => {
                if (extractIsPromiseCanceled(newValue) === false) {
                    quarkHistoryTracker.addHistoryEntry({
                        source: "Async-Dispatch",
                        stackTrace,
                        initialState: {
                            type: "Value",
                            value: getState(),
                        },
                        dispatchedUpdate: {
                            type: "Value",
                            value: result,
                        },
                    });
                }
            });
        }
        return resume(newValue);
    };
}
