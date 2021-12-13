import type {
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
} from "./Types";
import {
  generateCustomActions,
  generateCustomSelectors,
  generateSelectHook,
  generateSetter,
  generateUseHook,
  isUpdateNecessary,
} from "./Utilities";
import { generateSubscribeFunction } from "./Utilities/GenerateSubscribeFunction";

/**
 * Creates a new quark object.
 *
 * @param initValue Initial data of the quark.
 * @param config Config allows for adding custom actions and selectors to the quark
 *   as well as changing when subscribed component should update.
 */
export function quark<
  T,
  ActionArgs extends any[],
  SelectorArgs extends any[],
  A extends QuarkActions<T, GetMiddlewareTypes<M>, ActionArgs>,
  S extends QuarkSelectors<T, SelectorArgs>,
  M extends QuarkMiddleware<T, any>[] = never[]
>(
  initValue: T,
  config: QuarkConfig<T, A, S, M> = {}
): Rewrap<Quark<T, QuarkObjectOptions<T, A, S, M>>> {
  const self: QuarkContext<T, GetMiddlewareTypes<M>> = {
    value: initValue,
    subscribers: new Set(),
    middlewares: config.middlewares ?? [],

    sideEffect: config.effect,
    stateComparator: config.shouldUpdate ?? isUpdateNecessary,

    configOptions: {
      allowRaceConditions: config.allowRaceConditions ?? false,
    },
  };

  const set = generateSetter(self);

  const customActions = generateCustomActions(
    self,
    set,
    config?.actions ?? {}
  ) as ParseActions<A>;

  const customSelectors = generateCustomSelectors(
    self,
    config?.selectors ?? ({} as S)
  );

  const get = () => self.value;

  const use = generateUseHook(self, customActions, set, get);

  const useSelector = generateSelectHook(self);

  const subscribe = generateSubscribeFunction(self);

  const quark: Quark<T, QuarkObjectOptions<T, A, S, M>> = {
    get,
    set,
    use,
    useSelector,
    subscribe,
    ...customActions,
    ...customSelectors,
  };

  return quark as any;
}
