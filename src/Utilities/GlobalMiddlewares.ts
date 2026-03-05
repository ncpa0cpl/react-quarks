import { QuarkMiddleware } from "../Types/Middlewares";

const GLOBAL_MIDDLEWARES: QuarkMiddleware<any>[] = [];

export const addGlobalQuarkMiddleware = (
  middleware: QuarkMiddleware<any>,
  at: "start" | "end" = "end",
) => {
  switch (at) {
    case "end":
      GLOBAL_MIDDLEWARES.push(middleware);
      break;
    case "start":
      GLOBAL_MIDDLEWARES.unshift(middleware);
      break;
  }
};

export const setGlobalQuarkMiddlewares = (
  middlewares: QuarkMiddleware<any>[],
) => {
  GLOBAL_MIDDLEWARES.splice(0, GLOBAL_MIDDLEWARES.length, ...middlewares);
};

export const getGlobalQuarkMiddlewares = () => {
  return GLOBAL_MIDDLEWARES.slice();
};
