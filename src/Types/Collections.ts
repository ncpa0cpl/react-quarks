import { NoopUpdate } from "../Utilities/Utils";
import { ParseActions } from "./Actions";
import { DeepReadonly, Quark, Selects, SetStateAction } from "./Quark";
import { QuarkType, Rewrap } from "./Utilities";

export type CollectionSetterApi<Q extends BaseCollection<any>> = {
  [K in keyof Q]: (action: SetStateAction<QuarkType<Q[K]>>) => any;
};

export type CollectinoSetter<Q extends BaseCollection<any>> = (
  api: CollectionSetterApi<Q>,
) => [k: string, action: any];

export type BaseCollection<T> = Record<string, Quark<T, any, any>>;

export type CollectionProcedureGenerator<Q extends BaseCollection<any>> =
  AsyncGenerator<
    CollectinoSetter<Q> | NoopUpdate,
    CollectinoSetter<Q> | NoopUpdate,
    void
  >;

export type CollectionActionApi<
  Q extends BaseCollection<any>,
> = Rewrap<
  & {
    isCanceled(): boolean;
    /** Can be yielded or returned from a procedure when no state updates are to be made. */
    noop(): NoopUpdate;
  }
  & {
    [K in keyof Q]: CollectionQuarkActionApi<QuarkType<Q[K]>>;
  }
>;

export type CollectionProcedureAction<Q extends BaseCollection<any>> = (
  api: CollectionActionApi<Q>,
  ...args: any[]
) => CollectionProcedureGenerator<Q>;

export type CollectionFuncAction<Q extends BaseCollection<any>> = (
  api: CollectionActionApi<Q>,
  ...args: any[]
) => void | Promise<void>;

export type CollectionAction<Q extends BaseCollection<any>> =
  | CollectionFuncAction<Q>
  | CollectionProcedureAction<Q>;

export type SelectableCollection<Q extends BaseCollection<any>> = {
  [K in keyof Q]: QuarkType<Q[K]>;
};

export type CollectionSelector<Q extends BaseCollection<any>, R> = (
  value: SelectableCollection<Q>,
  ...args: any
) => R;

export type CollectionConfig<
  Q extends BaseCollection<any>,
  Actions extends Record<string, CollectionAction<Q>>,
  Selectors extends Record<string, CollectionSelector<Q, any>>,
> = {
  /**
   * Default: `queue`
   *
   * Modes:
   * - `cancel` - subsequent updates cancel any previous pending updates
   * - `queue` - subsequent updates will all apply in the same order they are dispatched
   * - `none` - all updates are always applied, in the order they resolve
   */
  mode?: "cancel" | "queue" | "none";
  actions?: Actions;
  selectors?: Selectors;
};

export type CollectionHook<Q extends BaseCollection<any>, Actions> =
  & {
    value: DeepReadonly<SelectableCollection<Q>>;
    set(
      setter: (api: CollectionActionApi<Q>) => void | Promise<void>,
    ): void | Promise<void>;
  }
  & ParseActions<Actions>;

export type Collection<
  Q extends BaseCollection<any>,
  Actions extends Record<string, CollectionAction<Q>>,
  Selectors extends Record<string, CollectionSelector<Q, any>>,
> = {
  /**
   * Retrieves the data held in all the quark.
   */
  get(): DeepReadonly<SelectableCollection<Q>>;
  /**
   * React hook to access the data in the quark. It can be only used within
   * React functional components.
   *
   * Changes to the quark state will cause the functional component to
   * re-render.
   *
   * This method returns two functions:
   *
   * - `get()` - to access the data
   * - `set()` - to updated the data
   */
  use(): CollectionHook<Q, Actions>;
  /**
   * Contains all the mutation functions that can be used to update the data within the
   * quark. Those are defined on the quark creation on the `actions` and `procedures`
   * properties.
   *
   * @example
   * const q = quark({}, {
   *  actions: {
   *    setValue(state, v: string) {
   *      return { value: v };
   *    }
   *  }
   * });
   *
   * q.act.setValue("Hello");
   * console.log(q.get()); // > { value: "Hello" }
   */
  act: ParseActions<Actions>;
  set(
    setter: (api: CollectionActionApi<Q>) => void | Promise<void>,
  ): void | Promise<void>;
  /**
   * Contains all the selector functions that can be used to access a part of the
   * data within the quark. Those are defined on the quark creation on the `selectors`
   * property.
   *
   * @example
   * const q = quark({ value: "Hello" }, {
   *   selectors: {
   *     reversed(state) {
   *       return state.value.split("").reverse().join("");
   *     }
   *   }
   * });
   *
   * console.log(q.select.reversed()); // > "olleH"
   */
  select: Selects<SelectableCollection<Q>, Selectors>;
};

export interface CollectionQuarkActionApi<T> {
  /**
   * Get the current state of the quark.
   */
  get(): T;
  /**
   * Set the state of the quark. In the default mode (cancel), if a new action/value is dispatched after
   * this action, this will not take an effect.
   *
   * Within procedures must be yielded or returned to take effect.
   */
  set(action: SetStateAction<T>): any | Promise<any>;
  isCanceled(): boolean;
  /**
   * Shorthand for `api.set(Object.assign(api.get(), patch)).
   *
   * Can take a selector as it's first argument to update a nested object.
   *
   * Just like set, within procedures must be yielded or returned to take effect.
   *
   * @example
   *
   * quark({foo:1, bar:2, baz: {v:""}}, {
   *  actions: {
   *    setFoo(api, to: number) {
   *      api.assign({ foo: to });
   *    },
   *    setBazV(api, v: string) {
   *      api.assign(s => s.baz, { v });
   *    },
   *    async *procedure(api, to1: number, to2: string) {
   *      // in procedures assign must be yielded
   *      yield api.assign({ foo: to1 });
   *      yield api.assign(s => s.baz, { v: to2 });
   *    }
   *  }
   * })
   */
  assign<S extends object>(
    select: (state: T) => S,
    patch: Partial<S>,
  ): any;
  assign(patch: Partial<T>): any;
}

export type CollectionProcedureApi<Q extends BaseCollection<any>> = {
  /**
   * Get the current state of the quark.
   */
  get(): SelectableCollection<Q>;
  isCanceled(): boolean;
  set(
    setter: (api: CollectionActionApi<Q>) => void | Promise<void>,
  ): any;
};
