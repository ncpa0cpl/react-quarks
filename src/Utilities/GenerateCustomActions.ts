import { isDraft, produce } from "immer";
import { CancelUpdate, FunctionAction, ProcedureAction } from "..";
import {
  ActionApi,
  ParseActions,
  QAction,
  QuarkActions,
} from "../Types/Actions";
import { QuarkContext, SetStateAction, UnsafeSet } from "../Types/Quark";
import {
  DispatchAction,
  setWithMiddlewares,
} from "./StateUpdates/ApplyMiddlewares";
import { AtomicUpdate } from "./StateUpdates/AsyncUpdates";
import { Immediate, Resolvable } from "./StateUpdates/Immediate";
import { unpackActionSync } from "./StateUpdates/UnpackAction";

/**
 * Generates 'action' function based on the actions defined in the Quark config.
 *
 * Each 'action' definition takes the Quark state value as it's first argument
 * and returns a new state value.
 *
 * @param initiateAction function that will start any given action
 * @param actionsObj Object containing 'action' definitions
 * @returns An object with the same structure as the `actions` argument
 * @internal
 */
export function generateCustomActions<T, A extends QuarkActions<T>>(
  self: QuarkContext<T>,
  unsafeSet: UnsafeSet<T>,
  actionsObj: A,
): ParseActions<A> {
  return Object.fromEntries(
    Object.entries(actionsObj).map(([name, impl]) => {
      impl = impl.bind(actionsObj);
      actionsObj[name as keyof A] = impl as any;
      const action = makeAction(self, unsafeSet, impl, name);
      return [name, action];
    }),
  ) as unknown as ParseActions<A>;
}

function makeAction<T>(
  self: QuarkContext<T>,
  unsafeSet: UnsafeSet<T>,
  action: QAction<T>,
  name: string | undefined,
) {
  const preparedAction = self.actions.get(action);
  if (preparedAction) {
    return preparedAction as (...args: any[]) => Resolvable<void>;
  }

  if (isGeneratorFunction(action)) {
    const prepared = makeProcedureAction(self, unsafeSet, action, name);
    self.actions.set(action, prepared);
    return prepared;
  } else {
    const prepared = makeBasicAction(self, unsafeSet, action, name);
    self.actions.set(action, prepared);
    return prepared;
  }
}

function makeBasicAction<T>(
  self: QuarkContext<T>,
  unsafeSet: UnsafeSet<T>,
  action: FunctionAction<T>,
  name: string | undefined,
) {
  return (...args: any[]) =>
    self.updateController.atomicUpdate(update =>
      finalizeAction(update, () => {
        const dispatch = new DispatchAction<T, any>(
          self,
          update,
          "function",
          self.middleware,
          action,
        );
        dispatch._actionName = name;

        return self.middleware.applyAction(
          dispatch,
          (d) => {
            try {
              const action = d.action;
              const { api, flush, result } = createActionApi(
                self,
                update,
                unsafeSet,
              );
              const f = flush(action(api, ...args));
              return f.then(() => result());
            } catch (err) {
              return Immediate.reject(err);
            }
          },
        );
      })
    );
}

function makeProcedureAction<T>(
  self: QuarkContext<T>,
  unsafeSet: UnsafeSet<T>,
  action: ProcedureAction<T>,
  name: string | undefined,
) {
  return (...args: any[]) =>
    self.updateController.atomicUpdate(update =>
      finalizeAction(update, () => {
        const dispatch = new DispatchAction<T, any>(
          self,
          update,
          "function",
          self.middleware,
          action,
        );
        dispatch._actionName = name;

        const result = self.middleware.applyProcedure(
          dispatch,
          async (d) => {
            let result: T | undefined;
            const action = d.action;
            try {
              const { api } = createProcedureApi(self, update, unsafeSet);
              const generator = action(api, ...args);
              let nextUp: IteratorResult<
                SetStateAction<T>,
                SetStateAction<T>
              >;
              do {
                if (update.isCanceled) {
                  await generator.throw(new CancelUpdate());
                  break;
                }

                nextUp = await generator.next(self.value);
                dispatch.action = nextUp.value;

                result = await unpackActionSync(dispatch, (next) => {
                  return update.update(next!);
                });
              } while (!nextUp.done);

              return Immediate.resolve(result ?? undefined);
            } finally {
              update.complete();
            }
          },
        );

        return result;
      })
    );
}

function createProcedureApi<T>(
  self: QuarkContext<T>,
  update: AtomicUpdate<T>,
  unsafeSet: UnsafeSet<T>,
): { api: ActionApi<T> } {
  const api: ActionApi<T> = {
    get() {
      return self.value;
    },
    set(t) {
      return () => t;
    },
    assign(...args: any[]) {
      if (args.length === 2) {
        const [selector, patch] = args as [(s: any) => any, object];
        return (state: T & object) => {
          if (isDraft(state)) {
            const s = selector(state);
            Object.assign(s, patch);
            return state;
          }

          return produce(state, draft => {
            const s = selector(draft);
            Object.assign(s, patch);
            return draft;
          });
        };
      }

      const [patch] = args as [object];
      return (state: T & object) => {
        if (isDraft(state)) {
          Object.assign(state, patch);
          return state;
        }
        return Object.assign({ ...state as object }, patch);
      };
    },
    unsafeSet(state) {
      return unsafeSet(state);
    },
    dispatchNew(
      action: QAction<T>,
      ...args: any[]
    ) {
      return makeAction(self, unsafeSet, action, undefined)(...args);
    },
    isCanceled() {
      return update.isCanceled;
    },
  };

  return { api };
}

function createActionApi<T>(
  self: QuarkContext<T>,
  update: AtomicUpdate<T>,
  unsafeSet: UnsafeSet<T>,
): {
  api: ActionApi<T>;
  flush<R>(then: R): Resolvable<R>;
  result(): Resolvable<T | undefined>;
} {
  const pending: Promise<any>[] = [];
  let result: Resolvable<T | undefined> | undefined;

  const actionSet = (action: SetStateAction<T>) => {
    const r = setWithMiddlewares(self, action, update);
    result = r;
    if (r instanceof Promise) {
      pending.push(r);
    } else if (r instanceof Immediate) {
      return Immediate.unpack(r);
    }
    return r;
  };

  const api: ActionApi<T> = {
    get() {
      return self.value;
    },
    set: actionSet,
    assign(...args: any[]) {
      if (args.length === 2) {
        const [selector, patch] = args as [(s: any) => any, object];

        return actionSet(current => {
          if (isDraft(current)) {
            const s = selector(current);
            Object.assign(s, patch);
            return current;
          }

          const newValue = produce(current, draft => {
            const s = selector(draft);
            Object.assign(s, patch);
            return draft;
          });
          return newValue;
        });
      }

      const [patch] = args as [object];
      return actionSet((state) => {
        if (isDraft(state)) {
          Object.assign(state as object, patch);
          return state;
        }

        const newValue = Object.assign({ ...state as object }, patch);
        return newValue as T;
      });
    },
    unsafeSet(state) {
      return unsafeSet(state);
    },
    dispatchNew(
      action: QAction<T>,
      ...args: any[]
    ) {
      return makeAction(self, unsafeSet, action, undefined)(...args);
    },
    isCanceled() {
      return update.isCanceled;
    },
  };

  return {
    api,
    result() {
      return result ?? Immediate.resolve(undefined);
    },
    flush(r) {
      if (r instanceof Promise) {
        return r.then((v) => {
          if (pending.length > 0) {
            return Promise.all(pending).then(() => v);
          }
          return v;
        });
      }
      if (pending.length > 0) {
        return Promise.all(pending).then(() => r);
      }
      return Immediate.resolve(r);
    },
  };
}

function finalizeAction<T>(
  update: AtomicUpdate<T>,
  fn: () => T | undefined | Resolvable<T | undefined>,
): T | undefined | Promise<T | undefined> {
  let isAsync = false;

  const doAfter = () => {
    update.complete();
  };

  try {
    const result = fn();
    if (result instanceof Promise) {
      isAsync = true;

      return result
        .catch(err => {
          if (CancelUpdate.isCancel(err)) {
            return undefined;
          }
          throw err;
        })
        .finally(doAfter);
    }

    if (result instanceof Immediate) {
      return Immediate.unpack(result as Immediate<T | undefined>);
    }

    return result as T | undefined;
  } catch (err) {
    if (CancelUpdate.isCancel(err)) {
      return undefined;
    }
    throw err;
  } finally {
    if (!isAsync) doAfter();
  }
}

const isGeneratorFunction = <T>(
  v: QAction<T>,
): v is ProcedureAction<T> =>
  Object.prototype.toString.call(v) === "[object AsyncGeneratorFunction]";
