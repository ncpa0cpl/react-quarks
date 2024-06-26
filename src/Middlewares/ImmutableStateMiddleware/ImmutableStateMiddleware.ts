import type { QuarkMiddleware } from "../../Types";

const freezeDeep = (obj: any) => {
  if (
    obj !== null &&
    (typeof obj === "object" || typeof obj === "function") &&
    !Object.isFrozen(obj)
  ) {
    if (Array.isArray(obj)) {
      obj.forEach(freezeDeep);
    } else {
      Object.getOwnPropertyNames(obj).forEach((prop) => {
        freezeDeep(obj[prop]);
      });
    }

    Object.freeze(obj);
  }

  return obj;
};

export const createImmutableStateMiddleware = (): QuarkMiddleware<
  any,
  undefined
> => {
  return (params) => {
    const { action, resume } = params;

    if (
      typeof action === "object" &&
      action !== null &&
      !(action instanceof Promise)
    ) {
      if (Object.isFrozen(action)) {
        return resume(action);
      }

      return resume(freezeDeep(action));
    }

    return resume(action);
  };
};
