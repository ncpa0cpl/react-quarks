import { AtomicUpdater } from "../Utilities/StateUpdates/AsyncUpdates";
import {
  ProcedureApi,
  ProcedureStateSetter,
  QuarkCustomProcedure,
} from "./Procedures";
import type { QuarkUpdateType, SetStateAction } from "./Quark";

export type BaseQuarkMiddlewareParams<T, ET> = {
  getState: () => T;
  action: SetStateAction<T, ET>;
  /**
   * Resumes the standard state update flow with the value provided in the
   * `value` argument. This argument is what any following middlewares will
   * receive.
   */
  resume: (value: SetStateAction<T, ET>) => any;
  /**
   * Interrupts the standard update flow and immediately updates the state with
   * the `value` specified in the argument. Any following middlewares will be
   * skipped.
   */
  set: (value: SetStateAction<T, ET>) => any;
  /**
   * Indicates if this state update was initiated directly via `set()` method
   * call (type = 'sync') or via asynchronous state update (type = 'async').
   *
   * Asynchronous state updates will trigger each middleware at least two times,
   * first time when the Promise object is passed to the `set()` method (type =
   * `sync`), and once more if the promise resolves and it's result is saved as
   * the new quark state (type = `async`).
   */
  updateType: Exclude<QuarkUpdateType, "async-generator">;
  updater: AtomicUpdater<T>;
};

export type ProcedureQuarkMiddlewareParams<T, ET> = {
  getState: () => T;
  action: (api: ProcedureApi<T>) => AsyncGenerator<
    ProcedureStateSetter<T>,
    ProcedureStateSetter<T>,
    T
  >;
  /**
   * Resumes the standard state update flow with the value provided in the
   * `value` argument. This argument is what any following middlewares will
   * receive.
   */
  resume: (value: QuarkCustomProcedure<T, any[]>) => void;
  /**
   * Interrupts the standard update flow and immediately updates the state with
   * the `value` specified in the argument. Any following middlewares will be
   * skipped.
   */
  set: (value: SetStateAction<T, ET>) => void;
  /**
   * Indicates if this state update was initiated directly via `set()` method
   * call (type = 'sync') or via asynchronous state update (type = 'async').
   *
   * Asynchronous state updates will trigger each middleware at least two times,
   * first time when the Promise object is passed to the `set()` method (type =
   * `sync`), and once more if the promise resolves and it's result is saved as
   * the new quark state (type = `async`).
   */
  updateType: Exclude<QuarkUpdateType, "async" | "sync" | "function">;
  updater: AtomicUpdater<T>;
};

export type QuarkMiddleware<T, ET> = (
  params:
    | BaseQuarkMiddlewareParams<T, ET>
    | ProcedureQuarkMiddlewareParams<T, ET>,
) => any;

type MiddlewareInputType<M> = M extends QuarkMiddleware<any, infer I> ? I
  : never;

export type GetMiddlewareTypes<M extends any[]> = {
  [K in keyof M]: MiddlewareInputType<M[K]>;
} extends Array<infer T> ? T extends undefined ? never
  : T
  : never;
