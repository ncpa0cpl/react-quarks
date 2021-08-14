import type { QuarkComparatorFn } from "./Quark";

export type QuarkSelector<T, U> = (value: T) => U;

export type QuarkCustomSelector<T, R = any> = (quarkState: T) => R;
export type QuarkSelectors<T> = Record<string, QuarkCustomSelector<T>>;

export type ParseSingleSelector<S> = S extends (v: any) => infer R
  ? (shouldComponentUpdate?: QuarkComparatorFn) => { get(): R }
  : never;

export type ParseSelectors<A> = A extends object
  ? {
      [K in keyof A]: ParseSingleSelector<A[K]>;
    }
  : Record<string, unknown>;
