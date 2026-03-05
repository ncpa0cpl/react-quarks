import type { QuarkSetterFn } from "./Quark";

export type QuarkCustomEffect<T> = (
  previousState: T,
  newState: T,
  set: QuarkSetterFn<T>,
) => void;
