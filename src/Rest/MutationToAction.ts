import { ActionApi, QAction } from "../Types/Actions";
import { ProcedureGenerator } from "../Types/Procedures";
import { objectMap } from "../Utilities/ObjectMap";
import {
  InternalT,
  Mutation,
  MutationContext,
  MutationParams,
  ResourceID,
  RestBaseActions,
} from "./Types";

function mutationToAction<T>(
  m: Mutation<T>,
  getID: (v: T) => ResourceID,
  actions: RestBaseActions<T>,
): QAction<InternalT<T>> {
  return (api, ...params) => {
    let undo: Function | undefined;

    const ctx: MutationContext<T> = {
      remove(...ids) {
        return actions.removeIn(api, ids);
      },
      get() {
        return api.get();
      },
      getById(id) {
        return api.get().data.find(e => getID(e) === id);
      },
      invalidate(id) {
        return actions.invalidate(api, id);
      },
      optimistic(...args: [ResourceID, T] | [T[]]) {
        if (args.length === 2) {
          const [id, elem] = args;

          const prev = api.get().data.find(e => getID(e) === id);
          if (prev) {
            undo = () => {
              actions.replace(api, id, prev);
            };
          } else {
            undo = () => {
              actions.remove(api, id);
            };
          }

          return actions.replace(api, id, elem);
        } else {
          const [elems] = args;

          const prev = api.get().data;
          undo = () => {
            api.assign({ data: prev });
          };

          return api.assign({ data: elems });
        }
      },
    };

    return m(ctx, ...params)
      .then(res => {
        if (res != null) {
          if (Array.isArray(res)) {
            api.assign({ data: res });
          } else {
            const id = getID(res);
            actions.replace(api, id, res);
          }
        }
      })
      .catch(err => {
        undo?.();
        throw err;
      });
  };
}

export function mutationsToActions<
  T,
  const Mutations extends { [x: string]: Mutation<T> },
>(
  m: Mutations,
  getID: (v: T) => ResourceID,
  actions: RestBaseActions<T>,
): {
  [K in keyof Mutations]: (
    api: ActionApi<InternalT<T>>,
    ...args: MutationParams<Mutations[K]>
  ) => ProcedureGenerator<InternalT<T>>;
} {
  return objectMap(m, (_, m) => mutationToAction(m, getID, actions)) as any;
}
