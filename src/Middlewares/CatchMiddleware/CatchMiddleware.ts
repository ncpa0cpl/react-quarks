import { ProcedureGenerator, SetStateAction } from "../..";
import { QuarkMiddleware } from "../../Types/Middlewares";
import { CancelUpdate } from "../../Utilities/CancelUpdate";

export function createCatchMiddleware<T>(params?: {
  onCatch: (e: unknown) => void;
}): QuarkMiddleware<T> {
  const onCatch = params?.onCatch ?? (() => {});

  return (params) => {
    if (params.updateType === "async-generator") {
      const { action, resume, getState } = params;
      resume(
        async function*(api, ...args: any[]): ProcedureGenerator<T> {
          try {
            const gen = await action(api, ...args);

            let next: IteratorResult<SetStateAction<T>, SetStateAction<T>>;
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

          throw new Error("unreachable");
        },
      );
      return;
    }

    if (params.action instanceof Promise) {
      params.resume(
        params.action.catch((err) => {
          onCatch(err);
          throw new CancelUpdate();
        }),
      );
      return;
    }

    try {
      params.resume(params.action);
      return;
    } catch (e) {
      onCatch(e);
      throw new CancelUpdate();
    }
  };
}
