import { ActionApi } from "../Types/Actions";
import { QuarkSelectors } from "../Types/Selectors";

export type RestQuarkParams<
  T,
  SingleParams,
  ListParams,
  Mutations extends { [x: string]: Mutation<T> } = {},
  Selectors extends QuarkSelectors<InternalT<T>> = {},
> = {
  id: (v: T) => ResourceID;
  get?: (id: ResourceID, args: SingleParams) => Promise<T | undefined>;
  list?: (args: ListParams) => Promise<T[]>;
  mutations: Mutations;
  selectors: Selectors;
  options?: RefetchOptions & {
    fetchOnMount?: boolean;
  };
};

export type ResourceID = string | number;

export type MutationContext<T> = {
  invalidate(id?: ResourceID): void;
  remove(...id: ResourceID[]): void;
  get(): InternalT<T>;
  getById(id: ResourceID): T | undefined;
  optimistic(id: ResourceID, elem: T): void;
  optimistic(elems: T[]): void;
};

export type Mutation<T> = (
  ctx: MutationContext<T>,
  ...params: any[]
) => Promise<T | T[] | void>;

export type MutationParams<M extends Mutation<any>> = M extends (
  ctx: MutationContext<any>,
  ...params: infer P
) => Promise<any> ? P
  : never;

export type InternalT<T> = {
  loading: boolean;
  initiated: boolean;
  error?: Error;
  data: T[];
  individualStatuses: Record<ResourceID, {
    loading: boolean;
    initiated: boolean;
    error?: Error;
  }>;
};

export type RefetchOptions = {
  /** @default true */
  auto?: boolean;
  /** @default 60_000 (60 seconds) */
  autoInterval?: number;
};

export type RestBaseActions<T> = {
  fetch(
    api: ActionApi<InternalT<T>>,
    id: ResourceID,
    params: any,
  ): Promise<void>;
  fetchList(api: ActionApi<InternalT<T>>, params: any): Promise<void>;
  invalidate(
    api: ActionApi<InternalT<T>>,
    id?: ResourceID,
  ): void | Promise<void>;
  replace(api: ActionApi<InternalT<T>>, id: ResourceID, elem: T): void;
  replaceOrInsert(api: ActionApi<InternalT<T>>, id: ResourceID, elem: T): void;
  remove(api: ActionApi<InternalT<T>>, id: ResourceID): void;
  removeIn(api: ActionApi<InternalT<T>>, ids: ResourceID[]): void;
  _dispathcAction(
    api: ActionApi<InternalT<T>>,
    dispatchFn: (api: ActionApi<InternalT<T>>) => void | Promise<void>,
  ): void | Promise<void>;
};
