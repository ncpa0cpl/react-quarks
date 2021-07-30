export type StateGenerator<T> = (oldVal: T) => T;

export type StateSetter<T> = StateGenerator<T> | T;

/** @internal */
export type QuarkSubscriber<T> = (currentState: T) => void;

export type QuarkComparatorFn = (a: unknown, b: unknown) => boolean;

export type QuarkSetterFn<T> = (newVal: T | StateGenerator<T>) => void;

export type QuarkGetterFn<T> = () => T;

export type QuarkSelector<T, U> = (value: T) => U;

/** @internal */
export type QuarkContext<T, A> = {
  value: T;
  effects: Set<QuarkCustomEffect<T, A>>;
  subscribers: Set<QuarkSubscriber<T>>;
  customActions: A | undefined;

  stateComparator: QuarkComparatorFn;
};

export type Quark<T, C extends { actions?: any; selectors?: any }> = {
  /** Retrieves the data held in the quark. */
  get(): T;
  /**
   * Updates the data held in the quark.
   *
   * @param newVal A new data or a function that takes the previous state of the
   *   quark and returns a new one.
   */
  set(newVal: StateSetter<T>): void;
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
    set(newVal: StateSetter<T>): void;
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

export type ParseSingleAction<A> = A extends (
  arg_0: any,
  ...args: infer ARGS
) => infer R
  ? (...args: ARGS) => void
  : never;

export type ParseActions<A> = A extends object
  ? {
      [K in keyof A]: ParseSingleAction<A[K]>;
    }
  : Record<string, unknown>;

export type ParseSingleSelector<S> = S extends (v: any) => infer R
  ? (shouldComponentUpdate?: QuarkComparatorFn) => { get(): R }
  : never;

export type ParseSelectors<A> = A extends object
  ? {
      [K in keyof A]: ParseSingleSelector<A[K]>;
    }
  : Record<string, unknown>;

export type QuarkCustomAction<T, ARGS extends any[]> = (
  quarkState: T,
  ...args: ARGS
) => T;

export type QuarkActions<T, ARGS extends any[]> = Record<
  string,
  QuarkCustomAction<T, ARGS>
>;

export type QuarkCustomSelector<T, R = any> = (quarkState: T) => R;
export type QuarkSelectors<T> = Record<string, QuarkCustomSelector<T>>;

export type QuarkCustomEffect<T, A> = (
  previousState: T,
  newState: T,
  stateActions: A & { set: QuarkSetterFn<T> }
) => void;
export type QuarkEffects<T, A> = Record<string, QuarkCustomEffect<T, A>>;

export type QuarkType<Q extends Quark<any, any>> = Q extends Quark<infer T, any>
  ? T
  : never;

export type QuarkConfig<A, S> = {
  /**
   * This method defines when the subscribed component should update. It receives as
   * it's arguments the old quark state and the new state and returns a boolean.
   *
   * If the returned value is false the subscribed components won't be updated.
   *
   * Default logic is as follows:
   *
   * - If the value held in quark is a primitive updates are dispatched whenever the
   *   value changes (ie. when changing the state to the same value it's already at,
   *   nothing will happen).
   * - If the value held in quark is a reference (objects, arrays, etc.) updates are
   *   dispatched after every `set()` method call or after any custom action takes place.
   */
  shouldUpdate?: QuarkComparatorFn;
  /**
   * A dictionary of custom actions to be added to this quark.
   *
   * Each action should be a method that takes the quark state as it's first
   * argument, and any number of other arguments as you see fit.
   *
   * Each action must return a new state of the quark.
   *
   * @example
   *   const counter = quark(0, {
   *     actions: {
   *       increment(counterState) {
   *         return counterState + 1;
   *       },
   *       add(counterState, num: number) {
   *         return counterState + num;
   *       },
   *     },
   *   });
   *
   *   // with the above custom actions the following:
   *   counter.set((s) => s + 1); // increment by one
   *   counter.set((s) => s + 123); // add 123 to the counter
   *
   *   // can instead be done like this:
   *   counter.increment(); // increment by one
   *   counter.add(123); // add 123 to the counter
   */
  actions?: A;
  /**
   * Custom selectors allow for creating shortcuts for the `useSelector()` hook.
   *
   * Selectors defined here are similar to the selectors you would pass down to the
   * `useSelector()`, they should take the quark state as it's argument and return a
   * data derived from it.
   *
   * @example
   *   const pageSettings = quark(
   *     {
   *       title: "My Website",
   *       theme: "dark",
   *     },
   *     {
   *       selectors: {
   *         useSelectTitle(state) {
   *           return state.title;
   *         },
   *         useSelectTheme(state) {
   *           return state.theme;
   *         },
   *       },
   *     }
   *   );
   *
   *   function MyComponent() {
   *     const title = pageSettings.useSelectTitle();
   *     console.log(title.get()); // Output: "My Website"
   *   }
   */
  selectors?: S;
};

export type QuarkObjectOptions<A, S, E> = {
  shouldUpdate: QuarkComparatorFn;
  actions: A;
  selectors: S;
  effects: E;
};
