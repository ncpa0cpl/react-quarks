import type { DeepReadonly } from "./Quark";
import type { IsLiteral, KeysOf } from "./Utilities";

export type QuarkSelector<T, R = unknown> = (
  value: T,
  ...args: any
) => R;

export type QuarkSelectors<T> = Record<
  string,
  QuarkSelector<T>
>;

export type ParseSingleSelector<S> = S extends (
  v: any,
  ...args: infer ARGS
) => infer R ? (...args: ARGS) => DeepReadonly<R>
  : never;

export type ParseSelectors<A> = A extends object
  ? IsLiteral<KeysOf<A>> extends true ? {
      [K in keyof A as K extends string ? K : never]: ParseSingleSelector<
        A[K]
      >;
    }
  : Record<never, never>
  : Record<never, never>;

export type ParseHookSelectors<A> = A extends object
  ? IsLiteral<KeysOf<A>> extends true ? {
      [K in keyof A as K extends string ? `use${Capitalize<K>}` : never]:
        ParseSingleSelector<
          A[K]
        >;
    }
  : Record<never, never>
  : Record<never, never>;
