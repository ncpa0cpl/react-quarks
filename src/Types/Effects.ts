import type { QuarkSetterFn } from "./Quark";

export type QuarkCustomEffect<T, A, ET> = (
  previousState: T,
  newState: T,
  stateActions: A & { set: QuarkSetterFn<T, ET> }
) => void;
export type QuarkEffects<T, A, ET> = Record<string, QuarkCustomEffect<T, A, ET>>;
