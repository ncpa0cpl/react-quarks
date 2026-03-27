export function objectMap<K, V, V2>(
  obj: Record<K, V>,
  mapper: (k: K, v: V) => V2,
): Record<K, V2> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, mapper(k, v)]),
  ) as any;
}

export function objectFlatMap<K, V, K2 extends string, V2>(
  obj: Record<K, V>,
  mapper: (k: K, v: V) => [K2, V2][],
): Record<K2, V2> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      const entries = mapper(k, v);
      return entries;
    }).flat(1),
  ) as any;
}
