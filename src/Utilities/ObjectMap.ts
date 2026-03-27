export function objectMap<K extends string | number | symbol, V, V2>(
  obj: Record<K, V>,
  mapper: (k: K, v: V) => V2,
): Record<K, V2> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, mapper(k as K, v as V)]),
  ) as any;
}

export function objectFlatMap<
  K extends string | number | symbol,
  V,
  K2 extends string,
  V2,
>(
  obj: Record<K, V>,
  mapper: (k: K, v: V) => [K2, V2][],
): Record<K2, V2> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      const entries = mapper(k as K, v as V);
      return entries;
    }).flat(1),
  ) as any;
}
