import { ProcedureGenerator } from "./Procedures";
import type { SetStateAction } from "./Quark";
import type {
  FinalReturnType as ResolvedAction,
  IsLiteral,
  KeysOf,
} from "./Utilities";

export interface ActionApi<T> {
  /**
   * Get the current state of the quark.
   */
  get(): T;
  /**
   * Set the state of the quark. In the default mode (cancel), if a new action/value is dispatched after
   * this action, this will not take an effect.
   *
   * Within procedures must be yielded or returned to take effect.
   */
  set(action: SetStateAction<T>): any | Promise<any>;
  /**
   * Create a new action, and run it immediately. This action will be treated
   * as a completely new dispatch. (affecting any in-flight updates)
   *
   * In the queue mode the given action will be queued to be ran after all other
   * updates are completed. It will create a deadlock if awaited within the action.
   *
   * It is possible to reuse other action defined on this quark:
   * @example
   * quark(0, {
   *    actions: {
   *        add(api, amount: number) {
   *            api.setState(v => v + amount);
   *        },
   *        otherAction(api, amount: number) {
   *            api.dispatchNew(this.add, 5);
   *            api.dispatchNew(this.add, 10);
   *        },
   *    }
   * })
   */
  dispatchNew<R extends void | Promise<void>>(
    action: (api: ActionApi<T>) => R,
  ): R;
  dispatchNew<R extends void | Promise<void>, A extends any[]>(
    action: (api: ActionApi<T>, ...args: A) => R,
    ...args: A
  ): R;
  /**
   * Sets the state regardless of what the current active dispatch is and will
   * not affect any in-flight updates.
   */
  unsafeSet(state: T | ((current: T) => T)): void;
  isCanceled(): boolean;
  /**
   * Shorthand for `api.set(Object.assign(api.get(), patch)).
   *
   * Can take a selector as it's first argument to update a nested object.
   *
   * Just like set, within procedures must be yielded or returned to take effect.
   *
   * @example
   *
   * quark({foo:1, bar:2, baz: {v:""}}, {
   *  actions: {
   *    setFoo(api, to: number) {
   *      api.assign({ foo: to });
   *    },
   *    setBazV(api, v: string) {
   *      api.assign(s => s.baz, { v });
   *    }
   *  }
   * })
   */
  assign<S extends object>(
    select: (state: T) => S,
    patch: Partial<S>,
  ): any | Promise<any>;
  assign(patch: T extends object ? Partial<T> : never): any | Promise<any>;
}

export interface QAction<T> {
  (
    api: ActionApi<T>,
    ...args: any[]
  ):
    | void
    | Promise<void>
    | ProcedureGenerator<T>;
}

export type QuarkActions<T> = Record<string, QAction<T>>;

export type ParseSingleAction<A> = A extends
  (arg_0: any, ...args: infer ARGS) => infer R
  ? (...args: ARGS) => ActionReturn<ResolvedAction<R>>
  : never;

export type ActionReturn<R> = R extends AsyncGenerator | Promise<any>
  ? Promise<void>
  : void;

export type ParseActions<A> = A extends object
  ? IsLiteral<KeysOf<A>> extends true ? {
      [K in keyof A]: ParseSingleAction<A[K]>;
    }
  : Record<never, never>
  : Record<never, never>;

export type InitiateActionFn<T> = (
  a: QAction<T>,
  args?: any[],
) => void;
