import type {
  GetMiddlewareTypes,
  ParseActions,
  Quark,
  QuarkActions,
  QuarkConfig,
  QuarkContext,
  QuarkEffects,
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
  initiateEffects,
  isUpdateNecessary,
} from "./Utilities";

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
  E extends QuarkEffects<
    T,
    ParseActions<Exclude<A, undefined>>,
    GetMiddlewareTypes<M>
  >,
  M extends QuarkMiddleware<T, any>[] = never[]
>(
  initValue: T,
  config: QuarkConfig<A, S, M> = {},
  effects?: E
): Quark<T, QuarkObjectOptions<A, S, M, E>> {
  const self: QuarkContext<T, ParseActions<A>, GetMiddlewareTypes<M>> = {
    value: initValue,
    effects: new Set(),
    subscribers: new Set(),
    customActions: undefined,
    middlewares: config.middlewares ?? [],

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
  self.customActions = customActions;

  const customSelectors = generateCustomSelectors(
    self,
    config?.selectors ?? ({} as S)
  );

  const get = () => self.value;

  const use = generateUseHook(self, setState, get);

  const useSelector = generateSelectHook(self);

  initiateEffects(self, effects ?? {});

  return {
    get,
    set: setState,
    use,
    useSelector,
    ...customActions,
    ...customSelectors,
  };
}
