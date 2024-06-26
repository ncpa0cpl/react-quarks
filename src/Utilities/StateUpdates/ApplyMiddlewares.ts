import type {
  QuarkContext,
  QuarkUpdateType,
  SetStateAction,
} from "../../Types";
import { QuarkCustomProcedure } from "../../Types/Procedures";
import { AtomicUpdater } from "./AsyncUpdates";

/**
 * Extract the list of middlewares from the Quark context and process the
 * `value` through each middleware in the list (unless one of the middlewares
 * stops the propagation).
 *
 * After processing through all middlewares or when propagation is stopped call
 * the `setterFn` with the final value.
 *
 * @param self Context of the Quark in question
 * @param value Value to be processed through middlewares
 * @param type Update type (one of: ['sync', 'async', 'async-generator'])
 * @param setterFn Function that updates the state of the Quark
 * @internal
 */
export function applyMiddlewares<
  T,
  ET,
  A extends SetStateAction<T, ET> | QuarkCustomProcedure<T, any[]>
>(
  self: QuarkContext<T, ET>,
  value: A,
  type: QuarkUpdateType,
  updater: AtomicUpdater<T>,
  setterFn: (v: A) => void | Promise<void>
) {
  const applyMiddlewareOfIndex = (
    index: number,
    v: A
  ): void | Promise<void> => {
    const nextMiddleware = self.middlewares[index];
    if (nextMiddleware) {
      return nextMiddleware({
        getState: () => self.value,
        action: v as any,
        resume: (resumedValue: any) =>
          applyMiddlewareOfIndex(index + 1, resumedValue as A),
        set: setterFn as any,
        updateType: type as any,
        updater,
      });
    } else {
      return (setterFn as any)(v);
    }
  };

  return applyMiddlewareOfIndex(0, value);
}
