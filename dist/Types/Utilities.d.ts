import type { Quark } from "./Quark";
export declare type QuarkType<Q extends Quark<any, any>> = Q extends Quark<infer T, any> ? T : never;
export declare type RecordValue<T extends object> = {
    [K in keyof T]: IsUnknownOrAny<T[K]> extends true ? undefined : T[K];
}[keyof T];
export declare type IsUnknownOrAny<U> = (any extends U ? true : false) extends true ? true : false;
export declare type Rewrap<T> = T extends Function ? T : T extends object ? T extends infer O ? {
    [K in keyof O as string extends K ? never : number extends K ? never : K]: Rewrap<O[K]>;
} : never : T;
