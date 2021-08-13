import type { QuarkMiddleware } from "../../Types";

export function createCatchMiddleware(params?: {
  onCatch: (e: unknown) => void;
}): QuarkMiddleware<any, undefined> {
  const onCatch = params?.onCatch ?? (() => {});

  return (prevState, value, resume) => {
    if (typeof value === "function") {
      try {
        const newValue = value(prevState);
        if (newValue instanceof Promise) {
          value.catch((e: unknown) => onCatch(e));
          return resume(value);
        }
      } catch (e) {
        return onCatch(e);
      }
    }

    if (value instanceof Promise) {
      value.catch((e) => onCatch(e));
      return resume(value);
    }

    try {
      return resume(value);
    } catch (e) {
      return onCatch(e);
    }
  };
}
