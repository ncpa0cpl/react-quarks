export declare type QuarkCustomAction<T, ARGS extends any[]> = (quarkState: T, ...args: ARGS) => T;
export declare type QuarkActions<T, ARGS extends any[]> = Record<string, QuarkCustomAction<T, ARGS>>;
export declare type ParseSingleAction<A> = A extends (arg_0: any, ...args: infer ARGS) => infer R ? (...args: ARGS) => void : never;
export declare type ParseActions<A> = A extends object ? {
    [K in keyof A]: ParseSingleAction<A[K]>;
} : Record<string, unknown>;
