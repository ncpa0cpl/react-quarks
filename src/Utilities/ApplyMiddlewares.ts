import type { QuarkContext } from "../Types";

export function applyMiddlewares<T, ET>(
  self: QuarkContext<T, any, ET>,
  value: T | ET,
  setterFn: (v: T) => void
) {
  const middlewares = self.middlewares;

  const applyMiddlewareOfIndex = (index: number, v: T | ET) => {
    const nextMiddleware = middlewares[index];
    if (nextMiddleware) {
      nextMiddleware(
        self.value,
        v,
        (resumedValue) => applyMiddlewareOfIndex(index + 1, resumedValue),
        setterFn
      );
    } else {
      setterFn(v as T);
    }
  };

  applyMiddlewareOfIndex(0, value);
}
