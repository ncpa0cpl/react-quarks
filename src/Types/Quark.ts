import type { ParseActions } from "./Actions";
import { QuarkCustomEffect } from "./Effects";
import type { GetMiddlewareTypes, QuarkMiddleware } from "./Middlewares";
import { ParseProcedures } from "./Procedures";
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

export type QuarkConfigOptions = { allowRaceConditions: boolean };

/**
 * @internal
 */
export type QuarkContext<T, ET> = {
  value: T;

  readonly subscribers: Set<QuarkSubscriber<T>>;
  readonly middlewares: QuarkMiddleware<T, ET>[];
  readonly configOptions: QuarkConfigOptions;

  readonly sideEffect?: QuarkCustomEffect<T, ET>;
  readonly stateComparator: QuarkComparatorFn;
  readonly syncStoreSubscribe: (callback: () => void) => () => boolean;
};

export type SetStateAction<T, M, TF = WithMiddlewareType<T, M>> =
  | TF
  | ((currentState: T) => TF)
  | Promise<TF>
  | ((currentState: T) => SetStateAction<T, M>)
  | Promise<SetStateAction<T, M>>;

/**
 * @internal
 */
export type QuarkSubscriber<T> = (currentState: T) => void;

export type QuarkComparatorFn = (a: unknown, b: unknown) => boolean;

export type QuarkSetterFn<QuarkType, MiddlewareTypes> = (
  newValue: SetStateAction<QuarkType, MiddlewareTypes>,
) => void;

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

export type QuarkSetResult<V extends SetStateAction<any, any>> =
  FinalReturnType<V> extends Promise<any> ? Promise<void>
    : Promise<any> extends FinalReturnType<V> ? Promise<void> | void
    : void;

export type QuarkHook<T, Actions, Procedures, Middlewares extends any[]> =
  & {
    value: DeepReadonly<T>;
    /**
     * Updates the data held in the quark.
     *
     * @param newVal A new data or a function that takes the previous state of the
     *   quark and returns a new one.
     */
    set<V extends SetStateAction<T, GetMiddlewareTypes<Middlewares>>>(
      newValue: V,
    ): QuarkSetResult<V>;
    /**
     * Sets the state regardless of what the current active dispatch is and will
     * not cancel any in-flight updates.
     */
    unsafeSet(newValue: T): void;
  }
  & ParseActions<Actions>
  & ParseProcedures<Procedures>;

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
    selector: QuarkSelector<T, ARGS, R>,
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
  Procedures,
  Selectors,
  Middlewares extends any[],
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
  set<V extends SetStateAction<T, GetMiddlewareTypes<Middlewares>>>(
    newValue: V,
  ): QuarkSetResult<V>;
  /**
   * Sets the state regardless of what the current active dispatch is and will
   * not cancel any in-flight updates.
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
  use(): QuarkHook<T, Actions, Procedures, Middlewares>;
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
  act: ParseActions<Actions> & ParseProcedures<Procedures>;
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
