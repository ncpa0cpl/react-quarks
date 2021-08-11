import type { StateSetter } from "./Quark";

export type QuarkMiddleware<T, ET> = (
  currentState: T,
  value: StateSetter<T, ET>,
  /**
   * Resumes the standard state update flow with the value provided in the `value`
   * argument. This argument is what any following middlewares will receive.
   */
  resume: (value: StateSetter<T, ET>) => void,
  /**
   * Interrupts the standard update flow and immediately updates the state with the
   * `value` specified in the argument. Any following middlewares will be skipped.
   */
  set: (value: StateSetter<T, never>) => void
) => void;

type MiddlewareInputType<M> = M extends QuarkMiddleware<any, infer I> ? I : never;

export type GetMiddlewareTypes<M extends any[]> = {
  [K in keyof M]: MiddlewareInputType<M[K]>;
} extends Array<infer T>
  ? T
  : never;
