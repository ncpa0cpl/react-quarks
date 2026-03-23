import _cloneDeep from "lodash.clonedeep";
import { QuarkMiddleware } from "../../Types/Middlewares";
import { DispatchAction } from "../../Utilities/StateUpdates/ApplyMiddlewares";
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

const MD_KEY = "DebugHistoryMiddleware";
type Meta = {
  source?: DispatchSource;
};

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

  const getOriginSource = (
    ctx: DispatchAction<any, any>,
    defaultVal?: DispatchSource,
  ) => {
    const meta = ctx.meta<Meta>(MD_KEY);
    if (!meta.source) {
      if (defaultVal) {
        meta.source = defaultVal;
      } else {
        switch (ctx.origin()) {
          case "sync":
            meta.source = "Sync";
            break;
          case "async":
            meta.source = "Promise";
            break;
          case "async-generator":
            meta.source = "Procedure";
            break;
          case "function":
            meta.source = "Function";
            break;
        }
      }
    }
    return meta.source!;
  };

  return {
    onAction(ctx) {
      const source = getOriginSource(ctx, "Action");

      const stackTrace = trace
        ? new Error().stack?.replace(/$Error\n\sat/gi, "Called from")
        : undefined;

      const update = ctx.update();
      quarkHistoryTracker.addHistoryEntry({
        updateID: update.id,
        source,
        phase: "Action",
        stackTrace,
        initialState: {
          type: "Value",
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
    onProcedure(ctx) {
      const source = getOriginSource(ctx, "Procedure");

      const stackTrace = trace
        ? new Error().stack?.replace(/$Error\n\sat/gi, "Called from")
        : undefined;

      const update = ctx.update();
      quarkHistoryTracker.addHistoryEntry({
        updateID: update.id,
        source,
        phase: "Procedure",
        stackTrace,
        initialState: {
          type: "Value",
          value: cloneDeep(ctx.get()),
        },
        dispatchedUpdate: {
          type: "Procedure",
          value: cloneDeep(ctx.action),
        },
        isCanceled: update.isCanceled,
      });

      return ctx.skip();
    },
    onFunction(ctx) {
      const source = getOriginSource(ctx);

      const stackTrace = trace
        ? new Error().stack?.replace(/$Error\n\sat/gi, "Called from")
        : undefined;

      const update = ctx.update();
      quarkHistoryTracker.addHistoryEntry({
        updateID: update.id,
        source,
        phase: "Function",
        stackTrace,
        initialState: {
          type: "Value",
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
      const source = getOriginSource(ctx);

      const stackTrace = trace
        ? new Error().stack?.replace(/$Error\n\sat/gi, "Called from")
        : undefined;

      const update = ctx.update();
      quarkHistoryTracker.addHistoryEntry({
        updateID: update.id,
        source,
        phase: "Promise",
        stackTrace,
        initialState: {
          type: "Value",
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
      const source = getOriginSource(ctx);

      const stackTrace = trace
        ? new Error().stack?.replace(/$Error\n\sat/gi, "Called from")
        : undefined;

      const update = ctx.update();
      quarkHistoryTracker.addHistoryEntry({
        updateID: update.id,
        source,
        phase: "Sync",
        stackTrace,
        initialState: {
          type: "Value",
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
