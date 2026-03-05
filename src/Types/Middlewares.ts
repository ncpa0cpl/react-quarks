import { AtomicUpdate } from "../Utilities/StateUpdates/AsyncUpdates";
import { GeneratorAction } from "./Procedures";
import type { QuarkUpdateType, SetStateAction } from "./Quark";

export type BaseQuarkMiddlewareParams<T> = {
  getState: () => T;
  action: SetStateAction<T>;
  /**
   * Resumes the standard state update flow with the value provided in the
   * `value` argument. This argument is what any following middlewares will
   * receive.
   */
  resume: (value: SetStateAction<T>) => unknown | Promise<unknown>;
  /**
   * Directly updates the state of the quark ommiting any other middlewares.
   * This is not a replacement for the resume() function. Middleware should always either
   * return the action on call the resume().
   */
  set: (value: SetStateAction<T>) => any;
  /**
   * Indicates if this state update was initiated directly via `set()` method
   * call (type = 'sync') or via asynchronous state update (type = 'async').
   *
   * Asynchronous state updates will trigger each middleware at least two times,
   * first time when the Promise object is passed to the `set()` method (type =
   * `sync`AtomicUpdateore if the promise resolves and it's result is saved as
   * the new quark state (type = `async`).
   */
  updateType: Exclude<QuarkUpdateType, "async-generator">;
  updater: AtomicUpdate<T>;
};

export type ProcedureQuarkMiddlewareParams<T> = {
  getState: () => T;
  action: GeneratorAction<T>;
  /**
   * Resumes the standard state update flow with the value provided in the
   * `value` argument. This argument is what any following middlewares will
   * receive.
   */
  resume: (value: GeneratorAction<T>) => unknown | Promise<unknown>;
  /**
   * Directly updates the state of the quark ommiting any other middlewares.
   * This is not a replacement for the resume() function. Middleware should always either
   * return the action on call the resume().
   */
  set: (value: SetStateAction<T>) => void;
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
  updater: AtomicUpdate<T>;
};

export type QuarkMiddleware<T> = (
  params:
    | BaseQuarkMiddlewareParams<T>
    | ProcedureQuarkMiddlewareParams<T>,
) => T | SetStateAction<T> | GeneratorAction<T> | void | undefined;
