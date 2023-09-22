import type { DeepReadonly } from "./Quark";
import type { IsLiteral, KeysOf } from "./Utilities";

export type QuarkSelector<T, ARGS extends any[], R = unknown> = (
  value: T,
  ...args: ARGS
) => R;

export type QuarkSelectors<T, ARGS extends any[]> = Record<
  string,
  QuarkSelector<T, ARGS>
>;

export type ParseSingleSelector<S> = S extends (
  v: any,
  ...args: infer ARGS
) => infer R
  ? (...args: ARGS) => DeepReadonly<R>
  : never;

export type ParseSelectors<A> = A extends object
  ? IsLiteral<KeysOf<A>> extends true
    ? {
        [K in keyof A as K extends string
          ? `use${Capitalize<K>}`
          : never]: ParseSingleSelector<A[K]>;
      } & {
        [K in keyof A as K extends string
          ? `select${Capitalize<K>}`
          : never]: ParseSingleSelector<A[K]>;
      }
    : Record<never, never>
  : Record<never, never>;
