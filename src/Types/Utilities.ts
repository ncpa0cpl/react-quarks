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

export type FinalReturnType<F, MAX extends null[] = [null]> = F extends (
  ...args: any[]
) => infer R
  ? MAX["length"] extends 10
    ? F
    : FinalReturnType<R, [...MAX, null]>
  : F;

export type Widen<T> = T extends string ? string : T extends number ? number : T;
