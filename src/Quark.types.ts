export type StateGenerator<T> = (oldVal: T) => T;

export type StateSetter<T> = StateGenerator<T> | T;

/**
 * @internal
 */
export type QuarkSubscriber<T> = (currentState: T) => void;

export type QuarkComparatorFn = (a: unknown, b: unknown) => boolean;

export type QuarkSetterFn<T> = (newVal: T | StateGenerator<T>) => void;

export type QuarkGetterFn<T> = () => T;

export type QuarkSelector<T, U> = (value: T) => U;

/**
 * @internal
 */
export type QuarkContext<T, A> = {
  value: T;
  effects: Set<QuarkCustomEffect<T, A>>;
  subscribers: Set<QuarkSubscriber<T>>;
  customActions: A | undefined;

  stateComparator: QuarkComparatorFn;
};

export type Quark<T, C extends { actions?: any; selectors?: any }> = {
  get(): T;
  set(newVal: StateSetter<T>): void;
  use(): {
    get(): T;
    set(newVal: StateSetter<T>): void;
  } & ParseActions<C["actions"]>;
  useSelector<U>(selector: QuarkSelector<T, U>): {
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
  ? () => { get(): R }
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
