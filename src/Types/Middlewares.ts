import type { QuarkUpdateType, StateSetter } from "./Quark";

export type QuarkMiddleware<T, ET> = (
  getState: () => T,
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
  set: (value: StateSetter<T, ET>) => void,
  /**
   * Indicates if this state update was initiated directly via `set()` method call
   * (type = 'sync') or via asynchronous state update (type = 'async').
   *
   * Asynchronous state updates will trigger each middleware up to two times, first
   * time when the Promise object is passed to the `set()` method (type = `sync`),
   * and once more if the promise resolves and it's result is saved as the new quark
   * state (type = `async`).
   */
  updateType: QuarkUpdateType
) => void;

type MiddlewareInputType<M> = M extends QuarkMiddleware<any, infer I> ? I : never;

export type GetMiddlewareTypes<M extends any[]> = {
  [K in keyof M]: MiddlewareInputType<M[K]>;
} extends Array<infer T>
  ? T
  : never;
