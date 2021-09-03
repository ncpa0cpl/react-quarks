import type { ParseActions } from "./Actions";
import type { QuarkCustomEffect } from "./Effects";
import type { GetMiddlewareTypes, QuarkMiddleware } from "./Middlewares";
import type { ParseSelectors, QuarkSelector } from "./Selectors";

export type QuarkConfigOptions = { allowRaceConditions: boolean };

/** @internal */
export type QuarkContext<T, A, ET> = {
  value: T;
  effects: Set<QuarkCustomEffect<T, A, ET>>;
  subscribers: Set<QuarkSubscriber<T>>;
  customActions: A | undefined;
  middlewares: QuarkMiddleware<T, ET>[];

  stateComparator: QuarkComparatorFn;

  configOptions: QuarkConfigOptions;
};

export type StateGenerator<T> = (oldVal: T) => T | Promise<T>;

// export type StatePromise<T> = Promise<T>;

// export type InternalStateSetter<T> = StatePromise<T> | T;

export type StateSetter<QuarkType, MiddlewareTypes> = [MiddlewareTypes] extends [
  never
]
  ? QuarkType | Promise<QuarkType> | StateGenerator<QuarkType>
  : QuarkType | MiddlewareTypes | Promise<QuarkType> | StateGenerator<QuarkType>;

/** @internal */
export type QuarkSubscriber<T> = (currentState: T) => void;

export type QuarkComparatorFn = (a: unknown, b: unknown) => boolean;

export type InternalQuarkSetterFn<T> = (newVal: T | StateGenerator<T>) => void;

export type QuarkSetterFn<QuarkType, MiddlewareTypes> = (
  newVal: StateSetter<QuarkType, MiddlewareTypes>
) => void;

export type QuarkGetterFn<T> = () => T;

/**
 * Update type indicates where the update originates from.
 *
 * A `sync` type indicates the update was dispatched via `.set(<VALUE>)` method.
 *
 * An `async` type indicates the update was dispatched as a result of a resolved
 * Promise that was dispatched via `.set(<VALUE>)` method. (dispatching a Promise
 * itself is not considered `async`).
 */
export type QuarkUpdateType = "sync" | "async";

export type Quark<
  T,
  C extends { actions?: any; selectors?: any; middlewares?: any }
> = {
  /** Retrieves the data held in the quark. */
  get(): T;
  /**
   * Updates the data held in the quark.
   *
   * @param newVal A new data or a function that takes the previous state of the
   *   quark and returns a new one.
   */
  set(newVal: StateSetter<T, GetMiddlewareTypes<C["middlewares"]>>): void;
  /**
   * React hook to access the data in the quark. It can be only used within React
   * functional components.
   *
   * Changes to the quark state will cause the functional component to re-render.
   *
   * This method returns two functions:
   *
   * - `get()` - to access the data
   * - `set()` - to updated the data
   */
  use(): {
    get(): T;
    set(newVal: StateSetter<T, GetMiddlewareTypes<C["middlewares"]>>): void;
  } & ParseActions<C["actions"]>;
  /**
   * React hook to access a part of the data within the quark or to retrieve it and transform.
   *
   * This hook will only cause component updates if the result of the `selector()`
   * function changes.
   *
   * How the `selector()` function return value is evaluated can be adjusted by
   * passing a comparator method as the second argument.
   *
   * IMPORTANT!
   *
   * Avoid passing a new `selector` function on every render, use the React
   * useCallback hook to memoize the selector or define it outside your component.
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
  useSelector<U>(
    selector: QuarkSelector<T, U>,
    shouldComponentUpdate?: QuarkComparatorFn
  ): {
    get(): U | undefined;
  };
} & ParseActions<C["actions"]> &
  ParseSelectors<C["selectors"]>;
