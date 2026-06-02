export function argsIs<T>(a: T, b: T) {
  const aType = typeof a;
  const bType = typeof b;

  if (aType !== bType) return false;

  if (aType === "object") {
    if (a === b) return true;

    const aIsNull = a == null;
    const bIsNull = b == null;

    if (aIsNull && bIsNull) return true;
    if (aIsNull !== bIsNull) return false;

    const aIsArray = Array.isArray(a);
    const bIsArray = Array.isArray(b);

    if (aIsArray !== bIsArray) return false;

    if (aIsArray && bIsArray) {
      return a.length === b.length
        && a.every((aElem, idx) => Object.is(aElem, b[idx]));
    } else {
      const aEntries = Object.entries(a as object);
      const bEntries = Object.entries(b as object);
      return aEntries.length === bEntries.length
        && aEntries.every(([key, value]) =>
          key in (b as object) && Object.is(value, (b as any)[key])
        );
    }
  }

  return a === b;
}
