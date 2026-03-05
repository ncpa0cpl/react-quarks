import { isDraft, produce } from "immer";
import { CancelUpdate, FunctionAction, GeneratorAction } from "..";
import {
  ActionApi,
  ParseActions,
  QAction,
  QuarkActions,
} from "../Types/Actions";
import { QuarkContext, SetStateAction, UnsafeSet } from "../Types/Quark";
import {
  applyMiddlewares,
  setWithMiddlewares,
} from "./StateUpdates/ApplyMiddlewares";
import { AtomicUpdate } from "./StateUpdates/AsyncUpdates";
import { Immediate, Resolvable } from "./StateUpdates/Immediate";
import { resolveUpdateType } from "./StateUpdates/ResolveUpdateType";
import { unpackStateSetterSync } from "./StateUpdates/UnpackAction";

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
      const action = makeAction(self, unsafeSet, impl);
      return [name, action];
    }),
  ) as unknown as ParseActions<A>;
}

function makeAction<T>(
  self: QuarkContext<T>,
  unsafeSet: UnsafeSet<T>,
  action: QAction<T>,
) {
  const preparedAction = self.actions.get(action);
  if (preparedAction) {
    return preparedAction as (...args: any[]) => Resolvable<void>;
  }

  if (isGeneratorFunction(action)) {
    const prepared = makeProcedureAction(self, unsafeSet, action);
    self.actions.set(action, prepared);
    return prepared;
  } else {
    const prepared = makeBasicAction(self, unsafeSet, action);
    self.actions.set(action, prepared);
    return prepared;
  }
}

function makeBasicAction<T>(
  self: QuarkContext<T>,
  unsafeSet: UnsafeSet<T>,
  action: FunctionAction<T>,
) {
  return (...args: any[]) =>
    self.updateController.atomicUpdate(update =>
      after(
        () => {
          const { api, flush } = createActionApi(self, update, unsafeSet);
          const result = action(api, ...args);
          return flush(result);
        },
        () => update.complete(),
      )
    );
}

function makeProcedureAction<T>(
  self: QuarkContext<T>,
  unsafeSet: UnsafeSet<T>,
  action: GeneratorAction<T>,
) {
  return (...args: any[]) =>
    self.updateController.atomicUpdate(update => {
      const { api } = createProcedureApi(self, update, unsafeSet);

      return applyMiddlewares(
        self,
        action,
        "async-generator",
        update,
        async action => {
          try {
            const generator = action(api, ...args);
            let nextUp: IteratorResult<SetStateAction<T>, SetStateAction<T>>;
            do {
              if (update.isCanceled) {
                await generator.throw(new CancelUpdate());
                break;
              }

              nextUp = await generator.next(self.value);
              const v = nextUp.value;

              const type = resolveUpdateType(v);
              applyMiddlewares(
                self,
                v,
                type,
                update,
                (action) =>
                  unpackStateSetterSync(self, update, action, (newState) => {
                    update.update(newState!);
                  }),
              );
            } while (!nextUp.done);
          } catch (err) {
            if (CancelUpdate.isCancel(err)) {
              return;
            }
            throw err;
          } finally {
            update.complete();
          }
        },
      );
    });
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
          return produce(state, draft => {
            const s = selector(draft);
            Object.assign(s, patch);
          });
        };
      }

      const [patch] = args as [object];
      return (state: T & object) => {
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
      return makeAction(self, unsafeSet, action)(...args);
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
): { api: ActionApi<T>; flush<R>(then: R): Resolvable<R> } {
  const pending: Promise<any>[] = [];

  const actionSet = (action: SetStateAction<T>) => {
    const r = setWithMiddlewares(self, action, update);
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
            return Object.assign(s, patch);
          }

          const newValue = produce(current, draft => {
            const s = selector(draft);
            Object.assign(s, patch);
          });
          return newValue;
        });
      }

      const [patch] = args as [object];
      return actionSet((state) => {
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
      return makeAction(self, unsafeSet, action)(...args);
    },
    isCanceled() {
      return update.isCanceled;
    },
  };

  return {
    api,
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

function after<T>(fn: () => T, doAfter: () => void): T {
  let isAsync = false;

  try {
    const result = fn();
    if (result instanceof Promise) {
      isAsync = true;
      result
        .finally(doAfter)
        .catch(() => {});
    }
    return result;
  } finally {
    if (!isAsync) doAfter();
  }
}

const isGeneratorFunction = <T>(
  v: QAction<T>,
): v is GeneratorAction<T> =>
  Object.prototype.toString.call(v) === "[object AsyncGeneratorFunction]";
