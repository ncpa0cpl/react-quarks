import {
  QuarkComparatorFn,
  QuarkConfigOptions,
  QuarkContext,
  QuarkCustomEffect,
  QuarkSubscriber,
} from "../src";
import { MdController } from "../src/Utilities/StateUpdates/ApplyMiddlewares";
import {
  AtomicUpdate,
  createUpdateController,
} from "../src/Utilities/StateUpdates/AsyncUpdates";

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
  const t = Math.round(Math.random() * 50);
  return sleep(t).then(() => value);
}

export function getTestQuarkContext<T = string>(params?: {
  value?: T;
  stateComparator?: QuarkComparatorFn;
  configOptions?: QuarkConfigOptions;
  sideEffect?: QuarkCustomEffect<T>;
  subscribers?: Set<QuarkSubscriber<T>>;
  immediateSubscribers?: Set<QuarkSubscriber<T>>;
  setter?: (update: AtomicUpdate<T>, action: T) => any;
}): QuarkContext<T> {
  const {
    configOptions = { mode: params?.configOptions?.mode ?? "cancel" },
    stateComparator = () => true,
    subscribers = new Set<QuarkSubscriber<T>>(),
    immediateSubscribers = new Set<QuarkSubscriber<T>>(),
    value = "" as any as T,
    sideEffect,
    setter,
  } = params ?? {};

  const c: QuarkContext<T> = {
    value,
    stateComparator,
    configOptions,
    mdInfo: [],
    middleware: new MdController([], [], [], [], []),
    subscribers,
    immediateSubscribers,
    sideEffect,
    actions: new Map(),
    updateController: null as any,
    syncStoreSubscribe() {
      return () => false;
    },
  };
  c.updateController = createUpdateController(c, setter);
  return c;
}

export function rndBool() {
  return Math.round(Math.random() * 100) % 2 === 0;
}

export function rndString(length = 10) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

export function opTracker() {
  const promises: Array<Promise<unknown>> = [];
  return {
    add(p: Promise<any>) {
      promises.push(p);
    },
    flush() {
      return Promise.all(promises);
    },
  };
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
  fn: (v: T, key: number | string) => Promise<void>,
) {
  const stack = testPromiseGenerator();

  iterable.forEach((value, key) => {
    stack.generate(() => fn(value, key));
  });

  return stack.waitForAll();
}

function Semaphore<T>() {
  let resolve: (value: T) => void;
  let reject: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: (v: T) => {
      return resolve(v);
    },
    reject: (err: any) => {
      return reject(err);
    },
  };
}

export function controlledPromise<T = void>() {
  let resolve: (value: T) => void;
  let reject: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const awaiting = Semaphore<Promise<any>>();

  return {
    promise: <Promise<T>> {
      then(onfulfilled, onrejected) {
        const r = promise.then(onfulfilled, onrejected);
        awaiting.resolve(r.then(() => {}, () => {}));
        return r as any;
      },
    },
    resolve: (v: T) => {
      resolve!(v);
      return awaiting.promise;
    },
    reject: (v: T) => {
      reject!(v);
      return awaiting.promise;
    },
    get dependenciesResolved() {
      return awaiting.promise;
    },
  };
}
