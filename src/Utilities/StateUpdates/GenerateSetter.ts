import { isDraft, produce } from "immer";
import { ActionApi, InitiateActionFn, QAction } from "../../Types/Actions";
import { ProcedureGenerator } from "../../Types/Procedures";
import { QuarkContext, SetStateAction } from "../../Types/Quark";
import { CancelUpdate } from "../CancelUpdate";
import { applyMiddlewares } from "./ApplyMiddlewares";
import { AtomicUpdater, createUpdateController } from "./AsyncUpdates";
import { createEventsDebouncer as createEventDebouncer } from "./EventsDispatcher";
import { Immediate } from "./Immediate";
import { processStateUpdate } from "./ProcessStateUpdate";
import { resolveUpdateType } from "./ResolveUpdateType";
import { unpackAction, unpackStateSetterSync } from "./UnpackAction";

const isGeneratorFunction = <A extends any[]>(
  v: (...args: A) => unknown,
): v is (...args: A) => AsyncGenerator =>
  Object.prototype.toString.call(v) === "[object AsyncGeneratorFunction]";

/**
 * Generates a function that allows for updating the state of the Quark.
 *
 * Updating the state with this function will trigger the Quark middlewares.
 *
 * @param self Quark context
 * @returns A method for updating the Quark state, this method can take as it's
 *   argument the new state value, a generator function or a Promise resolving
 *   to the new value.
 * @internal
 */
export function generateSetter<T>(self: QuarkContext<T>) {
  const { debounceEvent } = createEventDebouncer();
  const updateController = createUpdateController<T>(
    self.configOptions.mode,
    (action: T) => {
      const previousState = self.value;
      self.value = action;

      return processStateUpdate({
        self,
        previousState,
        applyMiddlewaresAndUpdateState: set,
        debounceEvent,
      });
    },
  );

  const onErr = (e: unknown) => {
    if (CancelUpdate.isCancel(e)) {
      return;
    }
    throw e;
  };

  const setVia = (
    action: SetStateAction<T>,
    updater: AtomicUpdater<T>,
  ) => {
    const type = resolveUpdateType(action);
    return applyMiddlewares(
      self,
      action,
      type,
      updater,
      (action2) =>
        unpackAction(self, updater, action2, (s) => {
          return updater.update(s!);
        }),
    );
  };

  /**
   * A method for updating the Quark state, this method can take as it's
   * argument the new state value, a generator function or a Promise resolving
   * to the new value.
   */
  const set = (action: SetStateAction<T>) => {
    return updateController.atomicUpdate(updater => {
      const result = setVia(action, updater)
        .catch(onErr)
        .finally(() => {
          updater.complete();
        });

      if (result instanceof Immediate) {
        return Immediate.unpack(result);
      }

      return result;
    });
  };

  /**
   * A method for updating the Quark state, this method can take as it's
   * argument the new state value, a generator function or a Promise resolving
   * to the new value.
   */
  const assign = (...args: [Partial<T>] | [(v: T) => any, any]) => {
    if (args.length === 2) {
      const [selector, patch] = args;
      return set((state) => {
        if (isDraft(state)) {
          const s = selector(state);
          return Object.assign(s, patch);
        }
        const newValue = produce(state, draft => {
          const s = selector(draft as T);
          Object.assign(s, patch);
        });
        return newValue;
      });
    }

    const [patch] = args;
    return set((state) => {
      return Object.assign(state as object, patch) as T;
    });
  };

  const unsafeSet = (action: T | ((current: T) => T)) => {
    return updateController.unsafeUpdate(updater => {
      return applyMiddlewares(
        self,
        action,
        resolveUpdateType(action),
        updater,
        (action2) => {
          const result = unpackStateSetterSync(self, updater, action2, (s) => {
            updater.update(s!);
          }).finally(() => {
            updater.complete();
          });

          if (result instanceof Immediate) {
            return Immediate.unpack(result);
          }

          return result;
        },
      );
    });
  };

  const initiateProcedure = async (
    updater: AtomicUpdater<T>,
    action: QAction<T>,
    args?: any[],
  ) => {
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
          return Object.assign(state, patch);
        };
      },
      unsafeSet(state) {
        return unsafeSet(state);
      },
      dispatchNew(
        action: (api: ActionApi<T>, ...args: any[]) => any,
        ...args: any[]
      ) {
        return initiateAction(action, args) as any;
      },
      isCanceled() {
        return updater.isCanceled;
      },
    };

    return applyMiddlewares(
      self,
      action,
      "async-generator",
      updater,
      async (action) => {
        try {
          const generator =
            (args ? action(api, ...args) : action(api)) as ProcedureGenerator<
              T
            >;
          let nextUp: IteratorResult<
            SetStateAction<T>,
            SetStateAction<T>
          >;
          do {
            if (updater.isCanceled) break;

            nextUp = await generator.next(self.value);
            const v = nextUp.value;

            const type = resolveUpdateType(v);
            applyMiddlewares(
              self,
              v,
              type,
              updater,
              (action) =>
                unpackStateSetterSync(self, updater, action, (newState) => {
                  updater.update(newState!);
                }),
            );
          } while (!nextUp.done);
        } catch (err) {
          if (CancelUpdate.isCancel(err)) {
            return;
          }
          throw err;
        } finally {
          updater.complete();
        }
      },
    );
  };

  const initiateAction: InitiateActionFn<T> = (action, args?: any[]) => {
    return updateController.atomicUpdate(updater => {
      return after(() => {
        if (isGeneratorFunction(action)) {
          return initiateProcedure(updater, action, args);
        } else {
          const pending: Promise<any>[] = [];

          const actionSet = (action: SetStateAction<T>) => {
            const r = setVia(action, updater);
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
            assign(...args: any) {
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
              return actionSet((current) => {
                const newValue = Object.assign(current as any, patch);
                return newValue;
              });
            },
            unsafeSet(state) {
              return unsafeSet(state);
            },
            dispatchNew(
              action: (api: ActionApi<T>, ...args: any[]) => any,
              ...args: any[]
            ) {
              return initiateAction(action, args) as any;
            },
            isCanceled() {
              return updater.isCanceled;
            },
          };

          const result = (args ? action(api, ...args) : action(api)) as
            | T
            | Promise<T>;

          if (pending.length > 0) {
            return Promise.all(pending).then(() => result);
          }

          return result;
        }
      }, () => updater.complete());
    });
  };

  return {
    set,
    assign,
    unsafeSet,
    initiateAction,
    updateController,
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
