/**
 * Compare old ans new state value and determine if the substituents should receive
 * `STATE CHANGED` event.
 *
 * This is the method that's used by the Quarks by default.
 *
 * @internal
 */
export function isUpdateNecessary(_old: unknown, _new: unknown) {
  return typeof _new === "object" ? true : !Object.is(_old, _new);
}
