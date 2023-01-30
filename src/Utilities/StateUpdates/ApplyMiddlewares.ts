import type { QuarkContext, QuarkUpdateType, SetStateAction } from "../../Types";

/**
 * Extract the list of middlewares from the Quark context and process the `value`
 * through each middleware in the list (unless one of the middlewares stops the
 * propagation).
 *
 * After processing through all middlewares or when propagation is stopped call the
 * `setterFn` with the final value.
 *
 * @param self Context of the Quark in question
 * @param value Value to be processed through middlewares
 * @param type Update type (one of: ['sync', 'async'])
 * @param setterFn Function that updates the state of the Quark
 * @internal
 */
export function applyMiddlewares<T, ET>(
  self: QuarkContext<T, ET>,
  value: SetStateAction<T, ET>,
  type: QuarkUpdateType,
  setterFn: (v: SetStateAction<T, ET>) => void | Promise<void>
) {
  const applyMiddlewareOfIndex = (
    index: number,
    v: SetStateAction<T, ET>
  ): void | Promise<void> => {
    const nextMiddleware = self.middlewares[index];
    if (nextMiddleware) {
      return nextMiddleware(
        () => self.value,
        v,
        (resumedValue) => applyMiddlewareOfIndex(index + 1, resumedValue),
        setterFn,
        type
      );
    } else {
      return setterFn(v);
    }
  };

  return applyMiddlewareOfIndex(0, value);
}
