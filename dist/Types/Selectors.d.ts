export declare type QuarkSelector<T, ARGS extends any[], R = unknown> = (value: T, ...args: ARGS) => R;
export declare type QuarkSelectors<T, ARGS extends any[]> = Record<string, QuarkSelector<T, ARGS>>;
export declare type ParseSingleSelector<S> = S extends (v: any, ...args: infer ARGS) => infer R ? (...args: ARGS) => {
    get(): R;
} : never;
export declare type ParseSelectors<A> = A extends object ? {
    [K in keyof A]: ParseSingleSelector<A[K]>;
} : Record<string, unknown>;
