import type { StateGenerator } from "../Types";

/** @internal */
export function isGenerator<T, ET>(v: any): v is StateGenerator<T | ET> {
  return typeof v === "function";
}
