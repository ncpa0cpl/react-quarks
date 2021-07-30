import type { StateGenerator, StateSetter } from "../Quark.types";

/**
 * @internal
 */
export function isGenerator<T>(v: StateSetter<T>): v is StateGenerator<T> {
  return typeof v === "function";
}
