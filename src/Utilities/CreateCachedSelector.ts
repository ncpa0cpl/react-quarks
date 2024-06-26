const CACHED_SELECTOR = Symbol("CACHED_SELECTOR");

function isCached(selector: any): boolean {
  return CACHED_SELECTOR in selector;
}

export function createCachedSelector<A extends any[], R>(
  selector: (...args: A) => R,
): (...args: A) => R {
  if (isCached(selector)) return selector;

  let lastArgs: A = [] as any;
  let cachedResult: R | undefined;

  const cachedSelector = (...args: A): R => {
    if (!compareArrays(args, lastArgs)) {
      cachedResult = selector(...args);
      lastArgs = args;
    }
    return cachedResult as R;
  };

  Object.defineProperty(cachedSelector, CACHED_SELECTOR, {
    value: true,
    writable: false,
    configurable: false,
  });

  return cachedSelector;
}

function compareArrays<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }

  return true;
}
