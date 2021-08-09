import type { InternalStateSetter, StateGenerator } from "../Types";

/** @internal */
export function isGenerator<T>(v: InternalStateSetter<T>): v is StateGenerator<T> {
  return typeof v === "function";
}
