import type { QuarkContext, QuarkUpdateType, StateSetter } from "../Types";

export function applyMiddlewares<T, ET>(
  self: QuarkContext<T, any, ET>,
  value: StateSetter<T, ET>,
  type: QuarkUpdateType,
  setterFn: (v: StateSetter<T, never>) => void
) {
  const applyMiddlewareOfIndex = (index: number, v: StateSetter<T, ET>) => {
    const nextMiddleware = self.middlewares[index];
    if (nextMiddleware) {
      nextMiddleware(
        () => self.value,
        v,
        (resumedValue) => applyMiddlewareOfIndex(index + 1, resumedValue),
        setterFn,
        type
      );
    } else {
      setterFn(v as T);
    }
  };

  applyMiddlewareOfIndex(0, value);
}
