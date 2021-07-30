/**
 * @internal
 */
export function isUpdateNecessary(_old: unknown, _new: unknown) {
  return typeof _new === "object" ? true : !Object.is(_old, _new);
}
