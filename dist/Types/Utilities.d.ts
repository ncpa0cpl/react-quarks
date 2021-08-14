import type { Quark } from "./Quark";
export declare type QuarkType<Q extends Quark<any, any>> = Q extends Quark<infer T, any> ? T : never;
export declare type RecordValue<T extends object> = {
    [K in keyof T]: IsUnknownOrAny<T[K]> extends true ? undefined : T[K];
}[keyof T];
export declare type IsUnknownOrAny<U> = (any extends U ? true : false) extends true ? true : false;
