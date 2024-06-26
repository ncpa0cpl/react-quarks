import type {
  DeepReadonly,
  GetMiddlewareTypes,
  Quark,
  QuarkActions,
  QuarkConfig,
  QuarkContext,
  QuarkMiddleware,
  QuarkSelectors,
  Widen,
} from "./Types";
import { QuarkProcedures } from "./Types/Procedures";
import {
  applyMiddlewares,
  generateCustomActions,
  generateCustomSelectors,
  generateSelectHook,
  generateSetter,
  generateUseHook,
  isUpdateNecessary,
} from "./Utilities";
import { generateCustomProcedures } from "./Utilities/GenerateCustomProcedures";
import { generateSubscribeFunction } from "./Utilities/GenerateSubscribeFunction";
import { getGlobalQuarkMiddlewares } from "./Utilities/GlobalMiddlewares";
import { registerQuark } from "./Utilities/QuarksCollection";

/**
 * Creates a new quark object.
 *
 * @param initValue Initial data of the quark.
 * @param config Config allows for adding custom actions and selectors to the
 *   quark as well as changing when subscribed component should update.
 */
export function quark<
  T,
  A extends QuarkActions<T, GetMiddlewareTypes<M>, ActionArgs>,
  P extends QuarkProcedures<T, ProcedureArgs>,
  S extends QuarkSelectors<T, SelectorArgs>,
  M extends QuarkMiddleware<T, any>[] = never[],
  SelectorArgs extends any[] = never[],
  ActionArgs extends any[] = never[],
  ProcedureArgs extends any[] = never[]
>(
  initValue: T,
  config: QuarkConfig<Widen<T>, A, P, S, M> = {}
): Quark<Widen<T>, A, P, S, M> {
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

  const { set, bareboneSet, initiateProcedure, updateController } =
    generateSetter(self);

  const customActions = generateCustomActions(
    set,
    config?.actions ?? ({} as A)
  );

  const customProcedures = generateCustomProcedures(
    self,
    initiateProcedure,
    config?.procedures ?? ({} as P)
  );

  const customSelectors = generateCustomSelectors(
    self,
    config?.selectors ?? ({} as S)
  );

  const get = () => self.value as DeepReadonly<T>;

  const use = generateUseHook(self, customActions, set);

  const useSelector = generateSelectHook(self);

  const subscribe = generateSubscribeFunction(self);

  const quark: Quark<T, A, P, S, M> = {
    set: set as any,
    get,
    use,
    useSelector,
    subscribe,
    ...customActions,
    ...customProcedures,
    ...customSelectors,
  };

  if (config.name !== undefined) {
    registerQuark(config.name, self);
  }

  applyMiddlewares(
    self,
    initValue,
    "sync",
    updateController.atomicUpdate(),
    bareboneSet
  );

  return quark as any;
}
