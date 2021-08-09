import type {
  InternalStateSetter,
  QuarkContext,
  QuarkSetterFn,
  StateSetter,
} from "../Types";

export function applyMiddlewares<T, ET>(
  self: QuarkContext<T, any, ET>,
  value: StateSetter<T, any>,
  setterFn: QuarkSetterFn<T>
) {
  const middlewares = self.middlewares;

  const applyMiddlewareOfIndex = (index: number, v: InternalStateSetter<T>) => {
    const nextMiddleware = middlewares[index];
    if (nextMiddleware) {
      nextMiddleware(
        self.value,
        value,
        (resumedValue) => applyMiddlewareOfIndex(index + 1, resumedValue),
        setterFn
      );
    } else {
      setterFn(v);
    }
  };

  applyMiddlewareOfIndex(0, value);
}
