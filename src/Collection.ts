import { useMemo } from "react";
import { useSyncExternalStore } from "use-sync-external-store";
import { CancelUpdate, ParseActions } from ".";
import { getContext } from "./Quark";
import {
  BaseCollection,
  CollectinoSetter,
  Collection,
  CollectionAction,
  CollectionActionApi,
  CollectionConfig,
  CollectionHook,
  CollectionSelector,
  CollectionSetterApi,
  SelectableCollection,
} from "./Types/Collections";
import { DispatchSource, Selects, SetStateAction } from "./Types/Quark";
import { createAssign } from "./Utilities/CreateAssign";
import { hookifySelector } from "./Utilities/GenerateCustomSelectors";
import { objectFlatMap, objectMap } from "./Utilities/ObjectMap";
import {
  DispatchAction,
  setWithMiddlewaresAndSetter,
} from "./Utilities/StateUpdates/ApplyMiddlewares";
import {
  AtomicUpdate,
  createCancelUpdateController,
  createQueuedUpdateController,
  createUnsafeUpdateController,
  UpdateController,
} from "./Utilities/StateUpdates/AsyncUpdates";
import { Immediate } from "./Utilities/StateUpdates/Immediate";
import { unpackAction } from "./Utilities/StateUpdates/UnpackAction";
import { capitalize, isGeneratorFunction, NoopUpdate } from "./Utilities/Utils";

export function collection<
  const Q extends BaseCollection<any>,
  const Actions extends Record<string, CollectionAction<Q>>,
  const Selectors extends Record<string, CollectionSelector<Q, any>>,
>(
  quarks: Q,
  config: CollectionConfig<Q, Actions, Selectors> = {},
): Collection<Q, Actions, Selectors> {
  const qContexts = objectMap(
    quarks,
    (k, q) => getContext(q),
  );
  const qList = Object.entries(qContexts).map(([, ctx]) => ctx);
  const qControllers = objectMap(qContexts, (_, ctx) => ctx.updateController);

  const context = {
    quarks,
    value: objectMap(quarks, (_, q) => q.get()) as SelectableCollection<Q>,
    syncStoreSubscribe(callback: () => void) {
      for (const ctx of qList) {
        ctx.subscribers.add(callback);
      }
      return () => {
        for (const ctx of qList) {
          ctx.subscribers.delete(callback);
        }
        return true;
      };
    },
  };

  for (const ctx of qList) {
    ctx.immediateSubscribers.add(() => {
      context.value = objectMap(
        quarks,
        (_, q) => q.get(),
      ) as SelectableCollection<Q>;
    });
  }

  type UT = [qkey: keyof Q, value: any];
  const updateController = (() => {
    const setState = (
      update: AtomicUpdate<UT>,
      action: UT,
    ) => {
      const [key, value] = action;
      const qUpdater = update.children![key as string]!;
      const res = qUpdater.update(value);
      if (res instanceof Promise) return res.then(() => action);
      return action;
    };

    const { mode = "queue" } = config;
    switch (mode) {
      case "cancel":
        return createCancelUpdateController<any>(setState) as UpdateController<
          UT
        >;
      case "queue":
        return createQueuedUpdateController<any>(setState) as UpdateController<
          UT
        >;
      case "none":
        return createUnsafeUpdateController<any>(setState) as UpdateController<
          UT
        >;
    }
    throw new Error("invalid Quark mode: " + mode);
  })().with(qControllers);

  const actionApi = (
    updater: AtomicUpdate<UT>,
    origin: DispatchSource,
    name?: string,
  ) => {
    const pending: Promise<any>[] = [];

    const api = {
      noop() {
        return new NoopUpdate();
      },
      isCanceled() {
        return updater.isCanceled;
      },
    };

    for (const qKey in quarks) {
      const q = quarks[qKey]!;

      let dispatch: undefined | DispatchAction<any, any>;
      const getDispatch = (updater: AtomicUpdate<any>, action: any) => {
        if (dispatch) {
          dispatch.action = action;
          return dispatch;
        }
        const ctx = getContext(q);
        dispatch = new DispatchAction(
          ctx,
          updater,
          origin,
          ctx.middleware,
          action,
        );
        if (name) {
          dispatch._actionName = name;
        }
        return dispatch;
      };

      const set = (action: SetStateAction<any>) => {
        if (action instanceof NoopUpdate) {
          return undefined;
        }

        const r = unpackAction(getDispatch(updater, action), s => {
          return updater.update([qKey, s]);
        });

        if (r instanceof Promise) {
          pending.push(r);
        }

        return r;
      };

      const assign = createAssign(set);
      // @ts-expect-error
      api[qKey] = {
        set,
        assign,
        get() {
          return q.get();
        },
        isCanceled() {
          return updater.isCanceled;
        },
      };
    }

    const flush = (r: void | Promise<void>) => {
      if (r instanceof Promise) {
        if (pending.length > 0) {
          return r.then(rv => {
            return Promise.all(pending).then(() => rv);
          });
        }
        return r.finally(() => {
          updater.complete();
        });
      } else {
        if (pending.length > 0) {
          return Promise
            .all(pending)
            .then(() => {
              return r;
            }).finally(() => {
              updater.complete();
            });
        }

        updater.complete();
        return r;
      }
    };

    return { api: api as CollectionActionApi<Q>, flush };
  };

  const procedureApi = (updater: AtomicUpdate<UT>) => {
    const api = {
      noop() {
        return new NoopUpdate();
      },
      isCanceled() {
        return updater.isCanceled;
      },
    };

    for (const qKey in quarks) {
      const q = quarks[qKey]!;
      const set = (action: SetStateAction<any>) => {
        return (a: CollectionSetterApi<Record<string, any>>) => a[qKey](action);
      };
      const assign = createAssign(set);
      // @ts-expect-error
      api[qKey] = {
        set,
        assign,
        get() {
          return q.get();
        },
        isCanceled() {
          return updater.isCanceled;
        },
      };
    }

    const setterApi = objectMap(
      qContexts,
      (k): (action: SetStateAction<any>) => any => {
        return (action) => [k, action];
      },
    );

    return {
      api: api as CollectionActionApi<Q>,
      setterApi: setterApi as CollectionSetterApi<Q>,
    };
  };

  const onErr = (err: unknown) => {
    if (CancelUpdate.isCancel(err)) return;
    throw err;
  };

  const set = (
    setter: (api: CollectionActionApi<Q>) => Promise<void> | void,
  ) => {
    updateController.atomicUpdate(update =>
      Immediate.catchFinally(
        () => {
          const { api, flush } = actionApi(update, "function");
          const r = setter(api);
          return flush(r);
        },
        onErr,
        () => update.complete(),
      )
    );
  };

  const selectors = objectFlatMap(
    config.selectors ?? {},
    (k, q) => {
      const baseSelector = (...args: any[]) => {
        return q(context.value, ...args);
      };

      return [
        [k, baseSelector],
        [
          "use" + capitalize(k),
          hookifySelector(context, q),
        ],
      ];
    },
  );

  const actions = objectMap(
    config.actions ?? {},
    (actionName, actionImpl) => {
      if (isGeneratorFunction(actionImpl)) {
        const runAction = (...args: any[]) => {
          return updateController.atomicUpdate(async updater => {
            let result: unknown | undefined;
            try {
              const { api, setterApi } = procedureApi(updater);
              const generator = actionImpl(api, ...args);
              let nextUp: IteratorResult<
                CollectinoSetter<Q> | NoopUpdate,
                CollectinoSetter<Q> | NoopUpdate
              >;
              do {
                if (updater.isCanceled) {
                  await generator.throw(new CancelUpdate());
                  break;
                }

                nextUp = await generator.next();

                const setter = nextUp.value;

                if (setter instanceof NoopUpdate) {
                  continue;
                }

                const collectionAction = setter(setterApi);

                if (
                  !Array.isArray(collectionAction)
                  || collectionAction.length !== 2
                ) {
                  throw new TypeError(
                    "invalid yield: yielded value must be a result of an api function call",
                  );
                }

                const [qKey, qAction] = collectionAction;

                result = await setWithMiddlewaresAndSetter(
                  qContexts[qKey],
                  qAction,
                  updater,
                  s => updater.update([qKey, s]),
                );
              } while (!nextUp.done);

              return result;
            } catch (err) {
              return onErr(err);
            } finally {
              updater.complete();
            }
          });
        };

        return runAction;
      }

      const runAction = (...args: any[]) => {
        return updateController.atomicUpdate(updater => {
          return Immediate.catchFinally(
            () => {
              const { api, flush } = actionApi(updater, "action", actionName);
              let r = actionImpl(api as any, ...args);
              return flush(r);
            },
            onErr,
            () => updater.complete(),
          );
        });
      };

      return runAction;
    },
  );

  const getSnapshot = () => context.value;
  const use = (): CollectionHook<SelectableCollection<Q>, Actions> => {
    const value = useSyncExternalStore(
      context.syncStoreSubscribe,
      getSnapshot,
    );

    return useMemo(() => ({
      set,
      value,
      ...actions,
    } as CollectionHook<SelectableCollection<Q>, Actions>), [value]);
  };

  const collection: Collection<Q, Actions, Selectors> = {
    act: actions as ParseActions<Actions>,
    select: selectors as Selects<SelectableCollection<Q>, Selectors>,
    use,
    set,
    get() {
      return context.value;
    },
  };

  return collection as any as Collection<Q, Actions, Selectors>;
}
