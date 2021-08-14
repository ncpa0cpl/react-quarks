import type { QuarkMiddleware } from "../../Types";

export function createCatchMiddleware(params?: {
  onCatch: (e: unknown) => void;
}): QuarkMiddleware<any, undefined> {
  const onCatch = params?.onCatch ?? (() => {});

  return (prevState, value, resume) => {
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
