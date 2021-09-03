import type { StateGenerator } from "../Types";

/**
 * Determine if the passed value is a State Generator.
 *
 * A State Generator is a method that receives the current Quark State value and
 * returns the new value or a Promise resolving the new value.
 *
 * @internal
 */
export function isGenerator<T>(v: any): v is StateGenerator<T> {
  return typeof v === "function";
}
