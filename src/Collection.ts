import { useMemo } from "react";
import { useSyncExternalStore } from "use-sync-external-store";
import { ParseActions } from ".";
import {
  BaseCollection,
  Collection,
  CollectionAction,
  CollectionActionApi,
  CollectionConfig,
  CollectionHook,
  CollectionSelector,
  SelectableCollection,
} from "./Collections/Types";
import { getContext } from "./Quark";
import { Selects, SetStateAction } from "./Types/Quark";
import { createAssign } from "./Utilities/CreateAssign";
import { hookifySelector } from "./Utilities/GenerateCustomSelectors";
import { objectFlatMap, objectMap } from "./Utilities/ObjectMap";
import {
  setWithMiddlewaresAndSetter,
} from "./Utilities/StateUpdates/ApplyMiddlewares";
import {
  AtomicUpdate,
  createCancelUpdateController,
  createQueuedUpdateController,
  createUnsafeUpdateController,
  UpdateController,
} from "./Utilities/StateUpdates/AsyncUpdates";
import { capitalize } from "./Utilities/Utils";

export function collection<
  const Q extends BaseCollection<any>,
  const Actions extends Record<string, CollectionAction<Q>>,
  const Selectors extends Record<string, CollectionSelector<Q, any>>,
>(
  quarks: Q,
  config: CollectionConfig<Q, Actions, Selectors>,
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

  const actionApi = (updater: AtomicUpdate<UT>) => {
    const pending: Promise<any>[] = [];

    const api = {
      isCanceled() {
        return updater.isCanceled;
      },
    };

    for (const qKey in quarks) {
      const q = quarks[qKey]!;
      const set = (action: SetStateAction<any>) => {
        const r = setWithMiddlewaresAndSetter(
          getContext(q),
          action,
          updater,
          s => updater.update([qKey, s]),
        );

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

  const set = (
    setter: (api: CollectionActionApi<Q>) => Promise<void> | void,
  ) => {
    updateController.atomicUpdate(update => {
      const { api, flush } = actionApi(update);
      const r = setter(api);
      return flush(r);
    });
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
    (_, actionImpl) => {
      const runAction = (...args: any[]) => {
        return updateController.atomicUpdate(updater => {
          const { api, flush } = actionApi(updater);

          let r = actionImpl(api as any, ...args);
          return flush(r);
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
