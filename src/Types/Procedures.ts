import { SetStateAction } from "./Quark";
import { IsLiteral, KeysOf } from "./Utilities";

export type ProcedureStateSetter<T> = T | ((draft: T) => T);

export type ProcedureGenerator<T> = AsyncGenerator<
  SetStateAction<T>,
  SetStateAction<T>,
  T
>;

export type ProcedureApi<T> = {
  getState(): T;
  unsafeSet(state: T | ((current: T) => T)): void;
  isCanceled(): boolean;
};

export type QProcedure<T> = (
  initState: ProcedureApi<T>,
  ...args: any[]
) => ProcedureGenerator<T>;

export type ParseSingleProcedure<A> = A extends (
  arg_0: any,
  ...args: infer ARGS
) => any ? (...args: ARGS) => Promise<void>
  : never;

export type ParseProcedures<A> = A extends object
  ? IsLiteral<KeysOf<A>> extends true ? {
      [K in keyof A]: ParseSingleProcedure<A[K]>;
    }
  : Record<never, never>
  : Record<never, never>;

export type InitiateProcedureFn<T> = (
  p: (
    api: ProcedureApi<T>,
  ) => AsyncGenerator<SetStateAction<T>, SetStateAction<T>, T>,
) => void;
