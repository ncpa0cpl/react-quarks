import { QuarkMiddleware } from "../Types/Middlewares";
import { QuarkContext } from "../Types/Quark";
import { MdController } from "./StateUpdates/ApplyMiddlewares";

export class GlobalMiddlewareController {
  static middlewares: QuarkMiddleware<any>[] = [];
  static quarks: Array<WeakRef<QuarkContext<any>>> = [];

  private static makeMdController<T>(q: QuarkContext<T>) {
    const qmds = q.mdInfo.map(e => e.m);

    const mdValue = qmds.filter(m => "onValue" in m) ?? [];
    const mdPromise = qmds.filter(m => "onPromise" in m) ?? [];
    const mdFunction = qmds.filter(m => "onFunction" in m) ?? [];
    const mdAction = qmds.filter(m => "onAction" in m) ?? [];
    const mdProcedure = qmds.filter(m => "onProcedure" in m) ?? [];

    q.middleware = new MdController(
      mdValue,
      mdPromise,
      mdFunction,
      mdAction,
      mdProcedure,
    );
  }

  static registerQuark<T>(q: QuarkContext<T>) {
    this.quarks.push(new WeakRef(q));

    q.mdInfo.unshift(
      ...this.middlewares.map(m => ({ m, source: "global" } as const)),
    );

    this.makeMdController(q);
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
            if (!q.mdInfo.some(({ m }) => m === middleware)) {
              q.mdInfo.push({ m: middleware, source: "global" });
            }
            break;
          case "start":
            if (!q.mdInfo.some(({ m }) => m === middleware)) {
              q.mdInfo.unshift({ m: middleware, source: "global" });
            }
            break;
        }
        this.makeMdController(q);
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
