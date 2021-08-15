export type QuarkSelector<T, U> = (value: T) => U;

export type QuarkCustomSelector<T, ARGS extends any[], R = unknown> = (
  quarkState: T,
  ...args: ARGS
) => R;
export type QuarkSelectors<T, ARGS extends any[]> = Record<
  string,
  QuarkCustomSelector<T, ARGS>
>;

export type ParseSingleSelector<S> = S extends (
  v: any,
  ...args: infer ARGS
) => infer R
  ? (...args: ARGS) => { get(): R }
  : never;

export type ParseSelectors<A> = A extends object
  ? {
      [K in keyof A]: ParseSingleSelector<A[K]>;
    }
  : Record<string, unknown>;
