import _cloneDeep from "lodash.clonedeep";
import { QuarkMiddleware } from "../../Types/Middlewares";
import { DispatchSource } from "../../Types/Quark";
import { getStateUpdateHistory } from "./UpdateHistory";

function getValueType(val: any): DispatchSource {
  if (val instanceof Promise) return "promise";
  if (typeof val === "function") return "function";
  return "value";
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
}): QuarkMiddleware<any> {
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

  return {
    onAction(ctx) {
      const stackTrace = trace
        ? new Error().stack?.replace(/$Error\n\sat/gi, "Called from")
        : undefined;

      const update = ctx.update();
      quarkHistoryTracker.addHistoryEntry({
        updateID: update.id,
        source: ctx.origin(),
        phase: "action",
        stackTrace,
        initialState: {
          type: "value",
          value: cloneDeep(ctx.get()),
        },
        dispatchedUpdate: {
          type: "action",
          value: cloneDeep(ctx.action),
        },
        isCanceled: update.isCanceled,
      });

      return ctx.skip();
    },
    onProcedure(ctx) {
      const stackTrace = trace
        ? new Error().stack?.replace(/$Error\n\sat/gi, "Called from")
        : undefined;

      const update = ctx.update();
      quarkHistoryTracker.addHistoryEntry({
        updateID: update.id,
        source: ctx.origin(),
        phase: "procedure",
        stackTrace,
        initialState: {
          type: "value",
          value: cloneDeep(ctx.get()),
        },
        dispatchedUpdate: {
          type: "procedure",
          value: cloneDeep(ctx.action),
        },
        isCanceled: update.isCanceled,
      });

      return ctx.skip();
    },
    onFunction(ctx) {
      const stackTrace = trace
        ? new Error().stack?.replace(/$Error\n\sat/gi, "Called from")
        : undefined;

      const update = ctx.update();
      quarkHistoryTracker.addHistoryEntry({
        updateID: update.id,
        source: ctx.origin(),
        phase: "function",
        stackTrace,
        initialState: {
          type: "value",
          value: cloneDeep(ctx.get()),
        },
        dispatchedUpdate: {
          type: getValueType(ctx.action),
          value: cloneDeep(ctx.action),
        },
        isCanceled: update.isCanceled,
      });

      return ctx.skip();
    },
    onPromise(ctx) {
      const stackTrace = trace
        ? new Error().stack?.replace(/$Error\n\sat/gi, "Called from")
        : undefined;

      const update = ctx.update();
      quarkHistoryTracker.addHistoryEntry({
        updateID: update.id,
        source: ctx.origin(),
        phase: "promise",
        stackTrace,
        initialState: {
          type: "value",
          value: cloneDeep(ctx.get()),
        },
        dispatchedUpdate: {
          type: getValueType(ctx.action),
          value: cloneDeep(ctx.action),
        },
        isCanceled: update.isCanceled,
      });

      return ctx.skip();
    },
    onValue(ctx) {
      const stackTrace = trace
        ? new Error().stack?.replace(/$Error\n\sat/gi, "Called from")
        : undefined;

      const update = ctx.update();
      quarkHistoryTracker.addHistoryEntry({
        updateID: update.id,
        source: ctx.origin(),
        phase: "value",
        stackTrace,
        initialState: {
          type: "value",
          value: cloneDeep(ctx.get()),
        },
        dispatchedUpdate: {
          type: getValueType(ctx.action),
          value: cloneDeep(ctx.action),
        },
        isCanceled: update.isCanceled,
      });

      return ctx.skip();
    },
  };
}
