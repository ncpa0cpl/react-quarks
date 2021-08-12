export function hasKey<K extends string>(
  obj: object,
  key: K
): obj is Record<K, unknown> {
  return key in obj;
}
