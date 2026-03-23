import { QuarkMiddleware } from "../../Types/Middlewares";

const freezeDeep = (obj: any) => {
  if (
    obj !== null
    && (typeof obj === "object" || typeof obj === "function")
    && !Object.isFrozen(obj)
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

export const createImmutableStateMiddleware = (): QuarkMiddleware<any> => {
  return {
    onValue(ctx) {
      const { action } = ctx;
      if (
        typeof action === "object"
        && action !== null
        && !(action instanceof Promise)
      ) {
        if (Object.isFrozen(action)) {
          return ctx.next(action);
        }

        return ctx.next(freezeDeep(action));
      }

      return ctx.next(action);
    },
  };
};
