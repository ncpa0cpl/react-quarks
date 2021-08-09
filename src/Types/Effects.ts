import type { QuarkSetterFn } from "./Quark";

export type QuarkCustomEffect<T, A> = (
  previousState: T,
  newState: T,
  stateActions: A & { set: QuarkSetterFn<T> }
) => void;
export type QuarkEffects<T, A> = Record<string, QuarkCustomEffect<T, A>>;
