import type { SetStateAction } from "./Quark";
import type { FinalReturnType, IsLiteral, KeysOf } from "./Utilities";

export type ActionApi<T, M = never[]> = {
  /**
   * Get the current state of the quark.
   */
  getState(): T;
  /**
   * Set the state of the quark. If a new action/value is dispatched after
   * this action, this will not take an effect.
   */
  setState(action: SetStateAction<T, M>): void;
  /**
   * Create a new action, and run it immediately. This action will be treated
   * as a completely new dispatch. (canceling any in-flight updates)
   */
  dispatchNew<R extends void | Promise<void>>(
    action: (api: ActionApi<T, M>) => R,
  ): R;
  /**
   * Sets the state regardless of what the current active dispatch is and will
   * not cancel any in-flight updates.
   */
  unsafeSet(state: T): void;
};

export type QuarkCustomAction<T, M, ARGS extends any[]> = (
  api: ActionApi<T, M>,
  ...args: ARGS
) => void | Promise<void>;

export type QuarkActions<T, M, ARGS extends any[]> = Record<
  string,
  QuarkCustomAction<T, M, ARGS>
>;
export type ParseSingleAction<A> = A extends (
  arg_0: any,
  ...args: infer ARGS
) => infer R ? (
    ...args: ARGS
  ) => FinalReturnType<R> extends Promise<any> ? Promise<void>
    : Promise<any> extends FinalReturnType<R> ? Promise<void> | void
    : void
  : never;

export type ParseActions<A> = A extends object
  ? IsLiteral<KeysOf<A>> extends true ? {
      [K in keyof A]: ParseSingleAction<A[K]>;
    }
  : Record<never, never>
  : Record<never, never>;

export type InitiateActionFn<T, M> = (
  a: (api: ActionApi<T, M>) => void,
) => void;
