import type {
  DeepReadonly,
  GetMiddlewareTypes,
  ParseActions,
  Quark,
  QuarkActions,
  QuarkConfig,
  QuarkContext,
  QuarkMiddleware,
  QuarkObjectOptions,
  QuarkSelectors,
  Rewrap,
  Widen,
} from "./Types";
import {
  applyMiddlewares,
  generateCustomActions,
  generateCustomSelectors,
  generateSelectHook,
  generateSetter,
  generateUseHook,
  isUpdateNecessary,
} from "./Utilities";
import { generateSubscribeFunction } from "./Utilities/GenerateSubscribeFunction";
import { getGlobalQuarkMiddlewares } from "./Utilities/GlobalMiddlewares";
import { registerQuark } from "./Utilities/QuarksCollection";

/**
 * Creates a new quark object.
 *
 * @param initValue Initial data of the quark.
 * @param config Config allows for adding custom actions and selectors to the quark
 *   as well as changing when subscribed component should update.
 */
export function quark<
  T,
  A extends QuarkActions<T, GetMiddlewareTypes<M>, ActionArgs>,
  S extends QuarkSelectors<T, SelectorArgs>,
  M extends QuarkMiddleware<T, any>[] = never[],
  SelectorArgs extends any[] = never[],
  ActionArgs extends any[] = never[]
>(
  initValue: T,
  config: QuarkConfig<Widen<T>, A, S, M> = {}
): Rewrap<Quark<Widen<T>, QuarkObjectOptions<Widen<T>, A, S, M>>> {
  const self: QuarkContext<T, GetMiddlewareTypes<M>> = {
    value: initValue,
    subscribers: new Set(),
    middlewares: config.middlewares ?? [],

    sideEffect: config.effect as any,
    stateComparator: config.shouldUpdate ?? isUpdateNecessary,

    configOptions: {
      allowRaceConditions: config.allowRaceConditions ?? false,
    },
  };

  self.middlewares.unshift(...getGlobalQuarkMiddlewares());

  const { set, bareboneSet } = generateSetter(self);

  const customActions = generateCustomActions(
    self,
    set,
    config?.actions ?? {}
  ) as ParseActions<A>;

  const customSelectors = generateCustomSelectors(
    self,
    config?.selectors ?? ({} as S)
  );

  const get = () => self.value as DeepReadonly<T>;

  const use = generateUseHook(self, customActions, set);

  const useSelector = generateSelectHook(self);

  const subscribe = generateSubscribeFunction(self);

  const quark: Quark<T, QuarkObjectOptions<T, A, S, M>> = {
    set: set as any,
    get,
    use,
    useSelector,
    subscribe,
    ...customActions,
    ...customSelectors,
  };

  if (config.name !== undefined) {
    registerQuark(config.name, self);
  }

  applyMiddlewares(self, initValue, "sync", bareboneSet);

  return quark as any;
}
