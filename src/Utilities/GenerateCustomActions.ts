import { CancelUpdate, FunctionAction, ProcedureAction } from "..";
import {
  ActionApi,
  ParseActions,
  QAction,
  QuarkActions,
} from "../Types/Actions";
import { QuarkContext, SetStateAction, UnsafeSet } from "../Types/Quark";
import { createAssign } from "./CreateAssign";
import { DispatchAction } from "./StateUpdates/ApplyMiddlewares";
import { AtomicUpdate } from "./StateUpdates/AsyncUpdates";
import { Immediate, Resolvable } from "./StateUpdates/Immediate";
import { unpackAction } from "./StateUpdates/UnpackAction";
import { isGeneratorFunction, NoopUpdate } from "./Utils";

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
    Immediate.unpackTry(
      self.updateController.atomicUpdate(update =>
        finalizeAction(update, () => {
          const dispatch = new DispatchAction<T, any>(
            self,
            update,
            "action",
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
                  dispatch,
                  update,
                  unsafeSet,
                );
                const a = action(api, ...args);
                return flush(a).then(() => result());
              } catch (err) {
                return Immediate.reject(err);
              }
            },
          );
        })
      ),
    );
}

function makeProcedureAction<T>(
  self: QuarkContext<T>,
  unsafeSet: UnsafeSet<T>,
  action: ProcedureAction<T>,
  name: string | undefined,
) {
  return (...args: any[]) =>
    Immediate.unpackTry(
      self.updateController.atomicUpdate(update =>
        finalizeAction(update, () => {
          const dispatch = new DispatchAction<T, any>(
            self,
            update,
            "procedure",
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
                  SetStateAction<T> | NoopUpdate,
                  SetStateAction<T> | NoopUpdate
                >;
                do {
                  if (update.isCanceled) {
                    await generator.throw(new CancelUpdate());
                    break;
                  }

                  nextUp = await generator.next(self.value);

                  if (nextUp.value instanceof NoopUpdate) {
                    continue;
                  }

                  dispatch.action = nextUp.value;

                  result = await unpackAction(dispatch, (next) => {
                    return update.update(next!);
                  });
                } while (!nextUp.done);

                return Immediate.resolve(result);
              } finally {
                update.complete();
              }
            },
          );

          return result;
        })
      ),
    );
}

function createProcedureApi<T>(
  self: QuarkContext<T>,
  update: AtomicUpdate<T>,
  unsafeSet: UnsafeSet<T>,
): { api: ActionApi<T> } {
  const api: ActionApi<T> = {
    noop() {
      return new NoopUpdate();
    },
    get() {
      return self.value;
    },
    set(t) {
      return () => t;
    },
    assign: createAssign(action => () => action),
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
  dispatch: DispatchAction<T, any>,
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
    if (action instanceof NoopUpdate) {
      return undefined;
    }

    dispatch.action = action;
    const r = unpackAction(dispatch, s => {
      return update.update(s);
    });

    if (r instanceof Promise) {
      pending.push(r);
    }

    result = r;
    return Immediate.unpackTry(r);
  };

  const assign = createAssign(actionSet);

  const api: ActionApi<T> = {
    noop() {
      return new NoopUpdate();
    },
    get() {
      return self.value;
    },
    set: actionSet,
    assign,
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
  fn: () => Resolvable<T | undefined>,
): Resolvable<T | undefined> {
  return fn()
    .catch(err => {
      if (CancelUpdate.isCancel(err)) {
        return undefined;
      }
      throw err;
    })
    .finally(() => {
      update.complete();
    });
}
