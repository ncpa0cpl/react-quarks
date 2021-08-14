import { cloneDeep as _cloneDeep } from "lodash";
import type { QuarkMiddleware } from "../../Types";
import { extractIsPromiseCanceled } from "../../Utilities/StateUpdates/AsyncUpdates";
import { getStateUpdateHistory } from "./UpdateHistory";

function getValueType(val: any) {
  if (val instanceof Promise) return "Promise";
  if (typeof val === "function") return "Generator";
  return "Value";
}

function cloneDeep<T>(v: T): T {
  if (v instanceof Promise || typeof v === "function") return v;
  return _cloneDeep(v);
}

export function createDebugHistoryMiddleware(options: {
  name: string;
  trace?: boolean;
  realTimeLogging?: boolean;
  useTablePrint?: boolean;
}): QuarkMiddleware<any, undefined> {
  const {
    name,
    trace = true,
    realTimeLogging = false,
    useTablePrint = true,
  } = options;
  const StateUpdateHistory = getStateUpdateHistory();
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

    if (newValue instanceof Promise) {
      newValue
        .then((v) => {
          const hasBeenCanceled = extractIsPromiseCanceled(newValue);
          if (hasBeenCanceled) {
            quarkHistoryTracker.addHistoryEntry({
              dispatchedUpdate: {
                type: getValueType(v),
                value: cloneDeep(v),
              },
              initialState: {
                type: "Value",
                value: getState(),
              },
              source: "Async-Dispatch",
              stackTrace: undefined,
              isCanceled: true,
            });
          }
        })
        .catch((e) => {});
    }

    return resume(newValue);
  };
}
