import type { StateSetter } from "./Quark";

export type QuarkCustomAction<T, ET, ARGS extends any[]> = (
  quarkState: T,
  ...args: ARGS
) => StateSetter<T, ET>;

export type QuarkActions<T, ET, ARGS extends any[]> = Record<
  string,
  QuarkCustomAction<T, ET, ARGS>
>;
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
