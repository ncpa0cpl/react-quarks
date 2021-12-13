import type { SetStateAction } from "./Quark";
export declare type QuarkCustomAction<T, ET, ARGS extends any[]> = (quarkState: T, ...args: ARGS) => SetStateAction<T, ET>;
export declare type QuarkActions<T, ET, ARGS extends any[]> = Record<string, QuarkCustomAction<T, ET, ARGS>>;
export declare type ParseSingleAction<A> = A extends (arg_0: any, ...args: infer ARGS) => infer R ? (...args: ARGS) => void : never;
export declare type ParseActions<A> = A extends object ? {
    [K in keyof A]: ParseSingleAction<A[K]>;
} : Record<string, unknown>;
