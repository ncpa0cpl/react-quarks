const CACHED_SELECTOR = Symbol("CACHED_SELECTOR");
const NIL = Symbol("NIL");
type NIL = typeof NIL;

function isCached(selector: any): boolean {
  return CACHED_SELECTOR in selector;
}

type Derefable = {
  deref(): any;
  wasGCd(): boolean;
};

class ObjectRef extends WeakRef<any> {
  wasGCd() {
    return this.deref() === undefined;
  }
}

class PrimitiveRef {
  constructor(private value: any) {}

  deref() {
    return this.value;
  }

  wasGCd() {
    return false;
  }
}

class CacheEntry<R> {
  private static derefable(v: any): Derefable {
    if (typeof v === "object" && v != null) {
      return new ObjectRef(v);
    }
    return new PrimitiveRef(v);
  }

  private readonly args: Derefable[];
  readonly result: R;

  constructor(private readonly cache: Cache<R>, args: any[], result: R) {
    this.args = args.map((arg) => CacheEntry.derefable(arg));
    this.result = result;
  }

  compare(args: any[]): boolean {
    const lastArgs = this.args;
    if (args.length !== this.args.length) return false;

    for (let i = 0; i < args.length; i++) {
      const b = lastArgs[i];
      if (b.wasGCd()) {
        this.cache.removeEntry(this);
        return false;
      }
      if (!Object.is(args[i], b.deref())) return false;
    }

    return true;
  }
}

class Cache<R> {
  private entries: CacheEntry<R>[] = [];

  private moveTop(idx: number, entry: CacheEntry<R>): void {
    this.entries.splice(idx, 1);
    this.entries.push(entry);
  }

  removeEntry(entry: CacheEntry<R>): void {
    const idx = this.entries.indexOf(entry);
    if (idx === -1) return;
    this.entries.splice(idx, 1);
  }

  invalidate() {
    if (this.entries.length <= 10) return;
    this.entries.splice(0, this.entries.length - 10);
  }

  add(args: any[], result: R): void {
    this.entries.push(new CacheEntry(this, args, result));
    this.invalidate();
  }

  find(args: any[]): R | NIL {
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      if (entry.compare(args)) {
        this.moveTop(i, entry);
        return entry.result;
      }
    }
    return NIL;
  }
}

export function createCachedSelector<A extends any[], R>(
  selector: (...args: A) => R,
): (...args: A) => R {
  if (isCached(selector)) return selector;

  const cache = new Cache<R>();

  const cachedSelector = (...args: A): R => {
    const cachedResult = cache.find(args);
    if (cachedResult !== NIL) return cachedResult;

    const result = selector(...args);
    cache.add(args, result);
    return result;
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

export function createBasicCachedSelector<A extends any[], R>(
  selector: (...args: A) => R,
): (...args: A) => R {
  let lastArgs: A = [] as any;
  let cachedResult: R | undefined;

  const cachedSelector = (...args: A): R => {
    if (!compareArrays(args, lastArgs)) {
      cachedResult = selector(...args);
      lastArgs = args;
    }
    return cachedResult as R;
  };

  return cachedSelector;
}
