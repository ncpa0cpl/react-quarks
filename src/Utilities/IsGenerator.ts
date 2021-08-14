import type { StateGenerator } from "../Types";

/** @internal */
export function isGenerator<T>(v: any): v is StateGenerator<T> {
  return typeof v === "function";
}
