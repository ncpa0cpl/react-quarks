import type { QuarkSetterFn } from "./Quark";

export type QuarkMiddleware<T, ET> = (
  currentState: T,
  value: T | ET,
  resume: (value: T) => void,
  set: QuarkSetterFn<T>
) => void;

type MiddlewareInputType<M> = M extends QuarkMiddleware<any, infer I> ? I : never;

export type GetMiddlewareTypes<M extends any[]> = {
  [K in keyof M]: MiddlewareInputType<M[K]>;
} extends Array<infer T>
  ? T
  : never;
