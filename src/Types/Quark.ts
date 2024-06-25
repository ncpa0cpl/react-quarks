import type { QuarkCustomEffect } from ".";
import type { ParseActions } from "./Actions";
import type { GetMiddlewareTypes, QuarkMiddleware } from "./Middlewares";
import type { ParseSelectors, QuarkSelector } from "./Selectors";
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
 * A `sync` type indicates the update was dispatched via `.set(<VALUE>)` method.
 *
 * An `async` type indicates the update was dispatched as a result of a resolved
 * Promise that was dispatched via `.set(<VALUE>)` method. (dispatching a
 * Promise itself is not considered `async`).
 */
export type QuarkUpdateType = "sync" | "async";

export type QuarkSetResult<V extends SetStateAction<any, any>> =
  FinalReturnType<V> extends Promise<any> ? Promise<void>
    : Promise<any> extends FinalReturnType<V> ? Promise<void> | void
    : void;

export type Quark<T, Actions, Selectors, Middlewares extends any[]> =
  & {
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
    use(): {
      value: DeepReadonly<T>;
      set<V extends SetStateAction<T, GetMiddlewareTypes<Middlewares>>>(
        newValue: V,
      ): QuarkSetResult<V>;
    } & ParseActions<Actions>;
    /**
     * React hook to access a part of the data within the quark or to retrieve it
     * and transform.
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
     *     const firstWord = myQuark.useSelector(selectFirstWord);
     *     console.log(firstWord.get()); // Output: "Hello"
     *   }
     */
    useSelector<ARGS extends any[], R>(
      selector: QuarkSelector<T, ARGS, R>,
      ...args: ARGS
    ): DeepReadonly<R>;
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
  }
  & ParseActions<Actions>
  & ParseSelectors<Selectors>;
