import type { SetStateAction } from "./Quark";
import type { FinalReturnType, IsLiteral, KeysOf } from "./Utilities";

export type QuarkCustomAction<T, ET, ARGS extends any[]> = (
  quarkState: T,
  ...args: ARGS
) => SetStateAction<T, ET>;

export type QuarkActions<T, ET, ARGS extends any[]> = Record<
  string,
  QuarkCustomAction<T, ET, ARGS>
>;
export type ParseSingleAction<A> = A extends (
  arg_0: any,
  ...args: infer ARGS
) => infer R
  ? (
      ...args: ARGS
    ) => FinalReturnType<R> extends Promise<any>
      ? Promise<void>
      : Promise<any> extends FinalReturnType<R>
      ? Promise<void> | void
      : void
  : never;

export type ParseActions<A> = A extends object
  ? IsLiteral<KeysOf<A>> extends true
    ? {
        [K in keyof A]: ParseSingleAction<A[K]>;
      }
    : Record<never, never>
  : Record<never, never>;
