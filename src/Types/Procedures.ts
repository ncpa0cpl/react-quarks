import { IsLiteral, KeysOf } from "./Utilities";

export type ProcedureStateSetter<T> = T | ((draft: T) => T);

export type QuarkCustomProcedure<T, ARGS extends any[]> = (
  initState: T,
  ...args: ARGS
) => AsyncGenerator<ProcedureStateSetter<T>, ProcedureStateSetter<T>, T>;

export type QuarkProcedures<T, ARGS extends any[]> = Record<
  string,
  QuarkCustomProcedure<T, ARGS>
>;

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
  p: () => AsyncGenerator<ProcedureStateSetter<T>, ProcedureStateSetter<T>, T>,
) => void;
