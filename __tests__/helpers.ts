import {
  QuarkComparatorFn,
  QuarkConfigOptions,
  QuarkContext,
  QuarkCustomEffect,
  QuarkMiddleware,
  QuarkSubscriber,
} from "../src";

export function array(length: number) {
  return Array.from({ length });
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

/**
 * Returns a Promise object that after a random time (in between 0ms to 50ms)
 * resolves the provided value.
 */
export function rndTResolve<T>(value: T) {
  return sleep(Math.round(Math.random() * 50)).then(() => value);
}

export function getTestQuarkContext<A extends any[], ET, T = string>(params?: {
  value?: T;
  stateComparator?: QuarkComparatorFn;
  configOptions?: QuarkConfigOptions;
  effects?: Set<QuarkCustomEffect<T, ET>>;
  middlewares?: QuarkMiddleware<T, ET>[];
  subscribers?: Set<QuarkSubscriber<T>>;
}): QuarkContext<T, ET> {
  const {
    configOptions = { allowRaceConditions: false },
    middlewares = [],
    stateComparator = () => true,
    subscribers = new Set<QuarkSubscriber<T>>(),
    value = "" as any as T,
  } = params ?? {};

  return {
    value,
    stateComparator,
    configOptions,
    middlewares,
    subscribers,
  };
}

export function rndBool() {
  return Math.round(Math.random() * 100) % 2 === 0;
}

export function rndString(length = 10) {
  var result = "";
  var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

export const testPromiseGenerator = () => {
  const generatedPromises: Array<Promise<unknown>> = [];

  return {
    generate<T>(fn: () => Promise<T> | T) {
      const p = new Promise<T>(async (resolve, reject) => {
        try {
          const r = await fn();
          resolve(r);
        } catch (e: unknown) {
          reject(e);
        }
      });
      generatedPromises.push(p);
      return p;
    },
    waitForAll() {
      return Promise.all(generatedPromises);
    },
  };
};

export function forAwait<T>(
  iterable: Array<T>,
  fn: (v: T, key: number | string) => Promise<void>
) {
  const stack = testPromiseGenerator();

  iterable.forEach((value, key) => {
    stack.generate(() => fn(value, key));
  });

  return stack.waitForAll();
}
