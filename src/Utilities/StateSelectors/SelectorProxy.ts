import type { SelectorProxy, SelectorProxyContext } from "../../Types";

export const PATH_SYMBOL = Symbol();

export function createProxySelector<T extends unknown>(): SelectorProxy<T> {
  const path: SelectorProxyContext = {
    path: [],
  };

  const selectorProxy = new Proxy(path, {
    get(target, property, receiver) {
      if (property === PATH_SYMBOL) {
        return target.path;
      }

      target.path.push(property);

      return receiver;
    },
    set() {
      throw new Error();
    },
    has(target, property) {
      if (property === PATH_SYMBOL) {
        return true;
      }

      return Reflect.has(target, property);
    },
  });

  return selectorProxy as unknown as SelectorProxy<T>;
}
