import { cloneDeep as _cloneDeep } from "lodash";
import type { QuarkMiddleware } from "../../Types";
import { getStateUpdateHistory } from "./UpdateHistory";

function getValueType(val: any) {
  if (val instanceof Promise) return "Promise";
  if (typeof val === "function") return "Generator";
  return "Value";
}

function cloneDeep<T>(v: T): T {
  if (v instanceof Promise) return v;
  return _cloneDeep(v);
}

export function createDebugHistoryMiddleware(options: {
  name: string;
  trace?: boolean;
}): QuarkMiddleware<any, undefined> {
  const { name, trace = true } = options;
  const StateUpdateHistory = getStateUpdateHistory();
  const quarkHistoryTracker = StateUpdateHistory.track(name);
  return (getState, newValue, resume, _, type) => {
    switch (type) {
      case "sync": {
        const stackTrace = trace ? new Error().stack : undefined;
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
