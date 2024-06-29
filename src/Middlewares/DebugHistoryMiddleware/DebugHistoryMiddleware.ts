import _cloneDeep from "lodash.clonedeep";
import { QuarkMiddleware } from "../../Types/Middlewares";
import { AtomicUpdater } from "../../Utilities/StateUpdates/AsyncUpdates";
import { DispatchSource } from "./Types/TrackedQuark";
import { getStateUpdateHistory } from "./UpdateHistory";

function getValueType(val: any) {
  if (val instanceof Promise) return "Promise";
  if (typeof val === "function") return "Function";
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
  const updaterSources = new WeakMap<AtomicUpdater<any>, DispatchSource>();

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
  return (params) => {
    const { action, resume, updater, updateType, getState } = params;
    let source = updaterSources.get(updater);

    switch (updateType) {
      case "sync": {
        if (!source) {
          source = "Sync-Dispatch";
          updaterSources.set(updater, source);
        }

        const stackTrace = trace
          ? new Error().stack?.replace(/$Error\n\sat/gi, "Called from")
          : undefined;
        quarkHistoryTracker.addHistoryEntry({
          updateID: updater.id,
          source,
          stackTrace,
          initialState: {
            type: "Value",
            value: cloneDeep(getState()),
          },
          dispatchedUpdate: {
            type: getValueType(action),
            value: cloneDeep(action),
          },
          isCanceled: updater.isCanceled,
        });
        break;
      }
      case "async": {
        if (!source) {
          source = "Async-Dispatch";
          updaterSources.set(updater, source);
        }

        const stackTrace = trace
          ? new Error().stack?.replace(/$Error\n\sat/gi, "Called from")
          : undefined;

        quarkHistoryTracker.addHistoryEntry({
          updateID: updater.id,
          source,
          stackTrace,
          initialState: {
            type: "Value",
            value: cloneDeep(getState()),
          },
          dispatchedUpdate: {
            type: getValueType(action),
            value: cloneDeep(action),
          },
          isCanceled: updater.isCanceled,
        });
        break;
      }
      case "function": {
        if (!source) {
          source = "Function-Dispatch";
          updaterSources.set(updater, source);
        }

        const stackTrace = trace
          ? new Error().stack?.replace(/$Error\n\sat/gi, "Called from")
          : undefined;

        quarkHistoryTracker.addHistoryEntry({
          updateID: updater.id,
          source,
          stackTrace,
          initialState: {
            type: "Value",
            value: cloneDeep(getState()),
          },
          dispatchedUpdate: {
            type: getValueType(action),
            value: cloneDeep(action),
          },
          isCanceled: updater.isCanceled,
        });
        break;
      }
      case "async-generator": {
        if (!source) {
          source = "Async-Generator-Dispatch";
          updaterSources.set(updater, source);
        }

        const stackTrace = trace
          ? new Error().stack?.replace(/$Error\n\sat/gi, "Called from")
          : undefined;

        quarkHistoryTracker.addHistoryEntry({
          updateID: updater.id,
          source,
          stackTrace,
          dispatchedUpdate: {
            type: "AsyncGenerator",
            value: action,
          },
          initialState: {
            type: "Value",
            value: cloneDeep(getState()),
          },
          isCanceled: updater.isCanceled,
        });
      }
    }

    return resume(action);
  };
}
