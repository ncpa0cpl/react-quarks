import { QuarkMiddleware } from "../../Types/Middlewares";
import { CancelUpdate } from "../../Utilities/CancelUpdate";

export function createCatchMiddleware(params?: {
  onCatch: (e: unknown) => void;
}): QuarkMiddleware<any, undefined> {
  const onCatch = params?.onCatch ?? (() => {});

  return (params) => {
    if (params.updateType === "async-generator") {
      const { action, resume, getState } = params;
      return resume(async function*(api) {
        try {
          const gen = action(api);

          let next: IteratorResult<unknown, unknown>;
          do {
            next = await gen.next(getState());
            if (next.done) {
              return next.value;
            }
            yield next.value;
          } while (!next.done);
        } catch (e) {
          onCatch(e);
          throw new CancelUpdate();
        }
      });
    }

    if (params.action instanceof Promise) {
      return params.resume(
        params.action.catch((err) => {
          onCatch(err);
          throw new CancelUpdate();
        }),
      );
    }

    try {
      return params.resume(params.action);
    } catch (e) {
      return onCatch(e);
    }
  };
}
