import type { QuarkSetterFn } from "./Quark";
export declare type QuarkMiddleware<T, ET> = (currentState: T, value: T | ET, resume: (value: T) => void, set: QuarkSetterFn<T>) => void;
declare type MiddlewareInputType<M> = M extends QuarkMiddleware<any, infer I> ? I : never;
export declare type GetMiddlewareTypes<M extends any[]> = {
    [K in keyof M]: MiddlewareInputType<M[K]>;
} extends Array<infer T> ? T : never;
export {};
