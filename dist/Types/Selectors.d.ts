import type { QuarkComparatorFn } from "./Quark";
export declare type QuarkSelector<T, U> = (value: T) => U;
export declare type QuarkCustomSelector<T, R = any> = (quarkState: T) => R;
export declare type QuarkSelectors<T> = Record<string, QuarkCustomSelector<T>>;
export declare type ParseSingleSelector<S> = S extends (v: any) => infer R ? (shouldComponentUpdate?: QuarkComparatorFn) => {
    get(): R;
} : never;
export declare type ParseSelectors<A> = A extends object ? {
    [K in keyof A]: ParseSingleSelector<A[K]>;
} : Record<string, unknown>;
