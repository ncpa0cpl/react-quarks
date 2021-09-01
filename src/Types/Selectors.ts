import type { InternalQuarkSetterFn } from "..";

export type ObjectPropTypes = string | number | symbol;

export class SelectorBasicReturnType<T> {
  private __do_not_touch() {}
}

export type ExtractSelectorBasicReturnType<T> = T extends SelectorBasicReturnType<
  infer R
>
  ? R
  : never;

export type SelectorProxyContext = {
  path: ObjectPropTypes[];
};

export type Def<T, UNDEF extends boolean> = UNDEF extends true ? undefined | T : T;

export type OR<A extends boolean, B extends boolean> = A extends true ? A : B;

export type CanBeUndefined<T> = T extends Exclude<T, undefined> ? false : true;

export type SelectorProxy<T, UNDEF extends boolean = false> = T extends object
  ? {
      [K in keyof T]-?: Exclude<T[K], undefined> extends object
        ? SelectorProxy<T[K], OR<UNDEF, CanBeUndefined<T[K]>>>
        : SelectorBasicReturnType<Def<T[K], UNDEF>>;
    }
  : SelectorBasicReturnType<T>;

export type GetSelectorProxyReturnType<T> = T extends SelectorBasicReturnType<any>
  ? ExtractSelectorBasicReturnType<T>
  : T extends object
  ? {
      [K in keyof T]: T[K] extends SelectorBasicReturnType<any>
        ? ExtractSelectorBasicReturnType<T[K]>
        : T[K];
    }
  : T;

export type QuarkSelector<T, R> = (
  selector: SelectorProxy<T>
) => SelectorProxy<R> | SelectorBasicReturnType<R>;

export type GetSelectorReturnType<T extends QuarkSelector<any, any>> =
  GetSelectorProxyReturnType<ReturnType<T>>;

export type QuarkCustomSelector<T, ARGS extends any[], R = unknown> = (
  selector: SelectorProxy<T>,
  ...args: ARGS
) => SelectorProxy<R> | SelectorBasicReturnType<R>;

export type QuarkSelectors<T, ARGS extends any[]> = Record<
  string,
  QuarkCustomSelector<T, ARGS>
>;

export type ParseSingleSelector<S> = S extends (
  v: any,
  ...args: infer ARGS
) => infer R
  ? (...args: ARGS) => {
      get: () => GetSelectorProxyReturnType<R>;
      set: InternalQuarkSetterFn<GetSelectorProxyReturnType<R>>;
    }
  : never;

export type ParseSelectors<A> = A extends object
  ? {
      [K in keyof A]: ParseSingleSelector<A[K]>;
    }
  : Record<string, unknown>;
