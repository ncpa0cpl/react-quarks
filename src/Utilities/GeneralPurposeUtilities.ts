/**
 * Check if the provided key is a property of the provided object and assert
 * that object type to allow the access to that property.
 *
 * @internal
 */
export function hasKey<K extends string | number | symbol>(
  obj: object,
  key: K,
): obj is Record<K, any> {
  return key in obj;
}
