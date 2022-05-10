import type { Quark } from "./Quark";

export type QuarkType<Q extends Quark<any, any>> = Q extends Quark<infer T, any>
  ? T
  : never;

export type RecordValue<T extends object> = {
  [K in keyof T]: IsUnknownOrAny<T[K]> extends true ? undefined : T[K];
}[keyof T];

export type IsUnknownOrAny<U> = (any extends U ? true : false) extends true
  ? true
  : false;

export type Rewrap<T> = T extends Function
  ? T
  : T extends object
  ? T extends infer O
    ? {
        [K in keyof O as string extends K
          ? never
          : number extends K
          ? never
          : K]: Rewrap<O[K]>;
      }
    : never
  : T;

export type IsLiteral<S extends string> = S extends `${infer A}${string}`
  ? true
  : false;

export type KeysOf<O extends object> = Exclude<keyof O, symbol | number>;
