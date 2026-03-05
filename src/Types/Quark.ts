import type { ParseActions } from "./Actions";
import { QuarkCustomEffect } from "./Effects";
import type { QuarkMiddleware } from "./Middlewares";
import type {
  ParseHookSelectors,
  ParseSelectors,
  QuarkSelector,
} from "./Selectors";
import type { QuarkSubscription } from "./Subscribe";
import type { FinalReturnType } from "./Utilities";

declare global {
  namespace Quarks {
    export interface TypeConfig {}
  }
}

type IsReadonlyStateEnabled = Quarks.TypeConfig extends {
  ENABLE_READONLY_STATES: true;
} ? true
  : false;

export type DeepReadonly<T> = IsReadonlyStateEnabled extends true
  ? T extends any[] | object ? {
      readonly [K in keyof T]: DeepReadonly<T[K]>;
    }
  : T
  : T;

export type WithMiddlewareType<T, Middlewares> = [Middlewares] extends [never]
  ? T
  : T | Middlewares;

export type QuarkConfigOptions = {
  /**
   * Modes:
   * - `cancel` - subsequent updates cancel any previous pending updates
   * - `queue` - subsequent updates will all apply in the same order they are dispatched
   * - `none` - all updates are always applied, in the order they resolve
   */
  mode: "cancel" | "queue" | "none";
};

/**
 * @internal
 */
export type QuarkContext<T> = {
  value: T;

  readonly subscribers: Set<QuarkSubscriber<T>>;
  readonly middlewares: {
    source: "own" | "global";
    m: QuarkMiddleware<T>;
  }[];
  readonly configOptions: QuarkConfigOptions;

  readonly sideEffect?: QuarkCustomEffect<T>;
  readonly stateComparator: QuarkComparatorFn;
  readonly syncStoreSubscribe: (callback: () => void) => () => boolean;
};

export type DispatchFunc<T> =
  | ((currentState: T) => T)
  | ((currentState: T) => SetStateAction<T>);

export type SetStateAction<T> =
  | T
  | DispatchFunc<T>
  | Promise<T>
  | Promise<SetStateAction<T>>;

/**
 * @internal
 */
export type QuarkSubscriber<T> = (currentState: T) => void;

export type QuarkComparatorFn = (a: unknown, b: unknown) => boolean;

export type QuarkSetterFn<QuarkType> = (
  newValue: SetStateAction<QuarkType>,
) => void;

export type QuarkAssignFn<T> =
  | ((
    select: (state: T) => any,
    patch: Partial<any>,
  ) => QuarkSetResult<T>)
  | ((patch: T extends object ? Partial<T> : never) => QuarkSetResult<T>);

export type QuarkGetterFn<T> = () => T;

/**
 * Update type indicates where the update originates from.
 *
 * - `sync` - the update originates from a synchronous call to the `set(value)` method.
 * - `async` - the update originates from an asynchronous call to the `set(Promise<value>)` method.
 * - `async-generator` - the update originates from an asynchronous procedure.
 * - `function` - the update originates from a function call `set(() => value)`.
 */
export type QuarkUpdateType = "sync" | "async" | "async-generator" | "function";

export type QuarkSetResult<V extends SetStateAction<any>> =
  FinalReturnType<V> extends Promise<any> ? Promise<void>
    : Promise<any> extends FinalReturnType<V> ? Promise<void> | void
    : void;

export type QuarkHook<T, Actions> =
  & {
    value: DeepReadonly<T>;
    /**
     * Updates the data held in the quark.
     *
     * @param newVal A new data or a function that takes the previous state of the
     *   quark and returns a new one.
     */
    set<V extends SetStateAction<T>>(
      newValue: V,
    ): QuarkSetResult<V>;
    /**
     * Shorthand for `quark.set(Object.assign(quark.get(), patch)).
     *
     * Can take a selector as it's first argument to update a nested object.
     *
     * @example
     *
     * const q = quark({foo:1, bar:2, baz: {v:""}})
     *
     * q.assign({ foo: 6 });
     * q.assign(s => s.baz, { v: "hi" });
     */
    assign<S extends object>(
      select: (state: T) => S,
      patch: Partial<S>,
    ): QuarkSetResult<T>;
    assign(patch: T extends object ? Partial<T> : never): QuarkSetResult<T>;
    /**
     * Sets the state regardless of what the current active dispatch is and will
     * not cancel any in-flight updates.
     */
    unsafeSet(newValue: T): void;
  }
  & ParseActions<Actions>;

export type HookSelectors<T, Selectors> = {
  /**
   * Use Selector Function can be used to access a part of the data
   * within the quark or to retrieve it and transform.
   *
   * This hook will only cause component updates if the result of the
   * `selector()` function changes.
   *
   * How the `selector()` function return value is evaluated can be adjusted by
   * passing a comparator method as the second argument.
   *
   * IMPORTANT!
   *
   * Avoid passing a new `selector` function on every render, use the React
   * useCallback hook to memoize the selector or define it outside your
   * component.
   *
   * @example
   *   const myQuark = quark(["Hello", "World"]);
   *
   *   const selectFirstWord = (state) => state[0];
   *
   *   function MyComponent() {
   *     const firstWord = myQuark.useSelector.$(selectFirstWord);
   *     console.log(firstWord); // > "Hello"
   *   }
   */
  use: <ARGS extends any[], R>(
    selector: QuarkSelector<T, R>,
    ...args: ARGS
  ) => DeepReadonly<R>;
} & ParseHookSelectors<Selectors>;

export type Selects<T, Selectors> =
  & {
    $: <R>(selector: (state: T) => R) => DeepReadonly<R>;
  }
  & ParseSelectors<Selectors>
  & HookSelectors<T, Selectors>;

export type Quark<
  T,
  Actions,
  Selectors,
> = {
  /**
   * Retrieves the data held in the quark.
   */
  get(): DeepReadonly<T>;
  /**
   * Updates the data held in the quark.
   *
   * @param newVal A new data or a function that takes the previous state of the
   *   quark and returns a new one.
   */
  set<V extends SetStateAction<T>>(
    newValue: V,
  ): QuarkSetResult<V>;
  /**
   * Shorthand for `quark.set(Object.assign(quark.get(), patch)).
   *
   * Can take a selector as it's first argument to update a nested object.
   *
   * @example
   *
   * const q = quark({foo:1, bar:2, baz: {v:""}})
   *
   * q.assign({ foo: 6 });
   * q.assign(s => s.baz, { v: "hi" });
   */
  assign<S extends object>(
    select: (state: T) => S,
    patch: Partial<S>,
  ): QuarkSetResult<T>;
  assign(patch: T extends object ? Partial<T> : never): QuarkSetResult<T>;
  /**
   * Sets the state regardless of what the current active dispatch is and will
   * not cancel any in-flight updates nor queue the update.
   */
  unsafeSet(newValue: T): void;
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
  use(): QuarkHook<T, Actions>;
  /**
   * Add a listener for the state changes of the Quark. Every time the state
   * change is detected provided callback will be triggered.
   *
   * @returns An object containing a `cancel` method which will remove the
   *   subscription when called.
   */
  subscribe(
    onQuarkStateChange: (state: T, cancelSubscription: () => void) => void,
  ): QuarkSubscription;
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
  select: Selects<T, Selectors>;
};
