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
 * @param effects Allows for adding side effects to the quark, those effects will be
 *   performed after any change to the quark state. Effects take three arguments,
 *
 *   - [`arg_0`] - previous state
 *   - [`arg_1`] - new/current state
 *   - [`arg_2`] - all of the actions of the quark (including `set()`)
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
): Quark<T, QuarkObjectOptions<T, A, S, M>> {
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

  const setState = generateSetter(self);

  const customActions = generateCustomActions(
    self,
    setState,
    config?.actions ?? {}
  ) as ParseActions<A>;

  const customSelectors = generateCustomSelectors(
    self,
    config?.selectors ?? ({} as S)
  );

  const get = () => self.value;

  const use = generateUseHook(self, customActions, setState, get);

  const useSelector = generateSelectHook(self);

  const subscribe = generateSubscribeFunction(self);

  return {
    get,
    set: setState,
    use,
    useSelector,
    subscribe,
    ...customActions,
    ...customSelectors,
  };
}
