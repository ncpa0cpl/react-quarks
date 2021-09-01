export function hasKey<K extends string | number | symbol>(
  obj: object,
  key: K
): obj is Record<K, any> {
  return key in obj;
}

export function isRegularObject(o: unknown): o is object {
  return typeof o === "object" && o !== null;
}
