import { QuarkMiddleware } from "../../Types/Middlewares";
import { CancelUpdate } from "../../Utilities/CancelUpdate";

export function createCatchMiddleware<T = any>(params?: {
  onCatch: (e: unknown) => void;
}): QuarkMiddleware<T> {
  const onCatch = params?.onCatch ?? (() => {});

  const errHandler = (err: unknown): never => {
    if (err instanceof CancelUpdate) {
      throw err;
    }

    onCatch(err);
    throw new CancelUpdate();
  };

  return {
    onFunction(ctx) {
      return ctx.next(ctx.action).catch(errHandler);
    },
    onAction(ctx) {
      return ctx.next(ctx.action).catch(errHandler);
    },
    onProcedure(ctx) {
      return ctx.next(ctx.action).catch(errHandler);
    },
    onPromise(ctx) {
      return ctx.next(ctx.action.catch(errHandler));
    },
  };
}
