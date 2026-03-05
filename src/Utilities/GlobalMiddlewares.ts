import { QuarkMiddleware } from "../Types/Middlewares";
import { QuarkContext } from "../Types/Quark";

export class GlobalMiddlewareController {
  static middlewares: QuarkMiddleware<any>[] = [];
  static quarks: Array<WeakRef<QuarkContext<any>>> = [];

  static registerQuark<T>(q: QuarkContext<T>) {
    this.quarks.push(new WeakRef(q));

    q.middlewares.unshift(
      ...this.middlewares.map(m => ({ m, source: "global" } as const)),
    );
  }

  static onMdAdded(
    middleware: QuarkMiddleware<any>,
    at: "start" | "end" = "end",
  ) {
    this.quarks = this.quarks.filter(r => r.deref() != null);
    for (const ref of this.quarks) {
      const q = ref.deref();
      if (q) {
        switch (at) {
          case "end":
            q.middlewares.push({ m: middleware, source: "global" });
            break;
          case "start":
            q.middlewares.unshift({ m: middleware, source: "global" });
            break;
        }
      }
    }
  }

  static add(
    middleware: QuarkMiddleware<any>,
    at: "start" | "end" = "end",
  ) {
    switch (at) {
      case "end":
        this.middlewares.push(middleware);
        break;
      case "start":
        this.middlewares.unshift(middleware);
        break;
    }

    this.onMdAdded(middleware, at);
  }

  static get() {
    return this.middlewares.slice();
  }
}

export const addGlobalQuarkMiddleware = (
  middleware: QuarkMiddleware<any>,
  at: "start" | "end" = "end",
) => GlobalMiddlewareController.add(middleware, at);

export const getGlobalQuarkMiddlewares = () => GlobalMiddlewareController.get();
