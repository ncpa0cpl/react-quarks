import {
  QuarkComparatorFn,
  QuarkConfigOptions,
  QuarkContext,
  QuarkCustomEffect,
  QuarkMiddleware,
  QuarkSubscriber,
} from "../src";

export function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

export function getTestQuarkContext<A extends any[], ET, T = string>(params?: {
  value?: T;
  stateComparator?: QuarkComparatorFn;
  configOptions?: QuarkConfigOptions;
  customActions?: A;
  effects?: Set<QuarkCustomEffect<T, A, ET>>;
  middlewares?: QuarkMiddleware<T, ET>[];
  subscribers?: Set<QuarkSubscriber<T>>;
}): QuarkContext<T, A, ET> {
  const {
    configOptions = { allowRaceConditions: false },
    customActions = <A>Array(),
    effects = new Set<QuarkCustomEffect<T, A, ET>>(),
    middlewares = [],
    stateComparator = () => true,
    subscribers = new Set<QuarkSubscriber<T>>(),
    value = "" as any as T,
  } = params ?? {};

  return {
    value,
    stateComparator,
    configOptions,
    customActions,
    effects,
    middlewares,
    subscribers,
  };
}
