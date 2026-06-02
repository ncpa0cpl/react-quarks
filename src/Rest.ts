import { useEffect, useRef } from "react";
import { quark } from "./Quark";
import { argsIs } from "./Rest/ArgsCompare";
import { mutationsToActions } from "./Rest/MutationToAction";
import { Refetcher } from "./Rest/Refetcher";
import { InternalT, Mutation, ResourceID, RestQuarkParams } from "./Rest/Types";
import { composeSelectors } from "./SelectorCompose";
import { ActionApi, ParseActions } from "./Types/Actions";
import { Selects } from "./Types/Quark";
import { QuarkSelectors } from "./Types/Selectors";

export function rest<
  T,
  const Mutations extends { [x: string]: Mutation<T> },
  const Selectors extends QuarkSelectors<InternalT<T>>,
  const ListParams = void,
  const SingleParams = void,
>(params: RestQuarkParams<T, SingleParams, ListParams, Mutations, Selectors>) {
  const { get, list, id: getID, mutations, selectors, options = {} } = params;

  const baseActions = {
    fetch(
      api: ActionApi<InternalT<T>>,
      id: ResourceID,
      params: SingleParams,
    ): Promise<void> {
      if (!get) return Promise.resolve();

      api.assign(
        s => s.individualStatuses,
        prev => ({
          [id]: {
            initiated: prev[id]?.initiated ?? false,
            error: undefined,
            loading: true,
          },
        }),
      );

      return get(id, params).then(
        elem => {
          if (elem != null) {
            this.replaceOrInsert(api, id, elem);
          } else {
            this.remove(api, id);
          }

          return api.assign(
            s => s.individualStatuses[id],
            {
              initiated: true,
              error: undefined,
              loading: false,
            },
          );
        },
        err =>
          api.assign(
            s => s.individualStatuses[id],
            prev => ({
              initiated: prev?.initiated ?? false,
              loading: false,
              error: err instanceof Error
                ? err
                : new Error("unexpected error: " + String(err)),
            }),
          ),
      );
    },
    fetchList(api: ActionApi<InternalT<T>>, params: ListParams): Promise<void> {
      if (!list) return Promise.resolve();

      api.assign({
        loading: true,
        error: undefined,
      });

      return list(params).then(
        elems =>
          api.assign({
            data: elems,
            initiated: true,
            loading: false,
          }),
        err =>
          api.assign({
            loading: false,
            error: err instanceof Error
              ? err
              : new Error("unexpected error: " + String(err)),
          }),
      );
    },
    invalidate(api: ActionApi<InternalT<T>>, id?: ResourceID) {
      return refetcher.refetchIfUsed(api, id);
    },
    replace(api: ActionApi<InternalT<T>>, id: ResourceID, elem: T) {
      api.set(state => {
        const newData = [...state.data];

        let elemIdx: number | undefined;
        for (let i = 0; i < state.data.length; i++) {
          if (id === getID(state.data[i])) {
            elemIdx = i;
            break;
          }
        }

        if (elemIdx != null) {
          newData[elemIdx] = elem;
        } else {
          return state;
        }

        return {
          ...state,
          data: newData,
        };
      });
    },
    replaceOrInsert(api: ActionApi<InternalT<T>>, id: ResourceID, elem: T) {
      api.set(state => {
        const newData = [...state.data];

        let elemIdx: number | undefined;
        for (let i = 0; i < state.data.length; i++) {
          if (id === getID(state.data[i])) {
            elemIdx = i;
            break;
          }
        }

        if (elemIdx != null) {
          newData[elemIdx] = elem;
        } else {
          newData.push(elem);
        }

        return {
          ...state,
          data: newData,
        };
      });
    },
    remove(api: ActionApi<InternalT<T>>, id: ResourceID) {
      api.set(c => ({ ...c, data: c.data.filter(elem => getID(elem) !== id) }));
    },
    removeIn(api: ActionApi<InternalT<T>>, ids: ResourceID[]) {
      api.set(c => ({
        ...c,
        data: c.data.filter(elem => !ids.includes(getID(elem))),
      }));
    },
    _dispathcAction(
      api: ActionApi<InternalT<T>>,
      dispatchFn: (api: ActionApi<InternalT<T>>) => void | Promise<void>,
    ) {
      return dispatchFn(api);
    },
  };

  const selectElem = (state: InternalT<T>, id: ResourceID) => {
    for (let i = 0; i < state.data.length; i++) {
      if (id === getID(state.data[i])) {
        return state.data[i];
      }
    }
  };

  const selectElemStatus = (state: InternalT<T>, id: ResourceID) => {
    return state.individualStatuses[id];
  };

  const baseSelectros = {
    get: composeSelectors(
      selectElem,
      selectElemStatus,
      (elem, status) => {
        return {
          data: elem,
          ...(status ?? {
            loading: false,
            initiated: false,
            error: undefined,
          }),
        };
      },
    ),
  };

  const q = quark({
    loading: false,
    initiated: false,
    data: [],
    error: undefined,
    individualStatuses: {},
  } as InternalT<T>, {
    actions: {
      ...mutationsToActions<T, Mutations>(
        mutations ?? {} as Mutations,
        getID,
        baseActions,
      ),
      ...baseActions,
    },
    selectors: {
      ...selectors,
      ...baseSelectros,
    },
  });

  const act = q.act as ParseActions<typeof baseActions>;
  const select = q.select as any as Selects<InternalT<T>, typeof baseSelectros>;

  const refetcher = new Refetcher<T>(
    options,
    action => act._dispathcAction(action),
  );

  function createRefetchInterval(
    id: ResourceID,
    args: SingleParams,
  ): () => void;
  function createRefetchInterval(args: ListParams): () => void;
  function createRefetchInterval(
    ...params: [id: ResourceID, args: SingleParams] | [args: ListParams]
  ) {
    if (params.length === 2) {
      const [id, args] = params;
      return refetcher.register(id, api => baseActions.fetch(api, id, args));
    }
    const [args] = params;
    return refetcher.register(api => baseActions.fetchList(api, args));
  }

  return {
    ...q,
    select: {
      ...q.select,
      useGet(id: ResourceID, params: SingleParams) {
        const lastUsedID = useRef(id);
        const lastUsedParams = useRef(params);

        // first mount fetch
        useEffect(() => {
          if (options.fetchOnMount || q.get().initiated === false) {
            act.fetch(id, params);
          }
        }, []);

        // params change fetch
        useEffect(() => {
          if (
            !argsIs(lastUsedParams.current, params) || lastUsedID.current !== id
          ) {
            lastUsedID.current = id;
            lastUsedParams.current = params;
            act.fetch(id, params);
          }
        });

        useEffect(() => {
          return refetcher.register(
            id,
            (api) => baseActions.fetch(api, id, lastUsedParams.current),
          );
        }, [id]);

        return select.useGet(id);
      },
    },
    use(params: ListParams) {
      const lastUsedParams = useRef(params);

      // first mount fetch
      useEffect(() => {
        if (options.fetchOnMount || q.get().initiated === false) {
          act.fetchList(params);
        }

        return refetcher.register((api) =>
          baseActions.fetchList(api, lastUsedParams.current)
        );
      }, []);

      // params change fetch
      useEffect(() => {
        if (!argsIs(lastUsedParams.current, params)) {
          lastUsedParams.current = params;
          act.fetchList(params);
        }
      });

      return q.use();
    },
    createRefetchInterval,
  };
}
