import { QuarkActions } from "./Types/Actions";
import { QuarkConfig } from "./Types/Config";
import { GetMiddlewareTypes, QuarkMiddleware } from "./Types/Middlewares";
import { QuarkProcedures } from "./Types/Procedures";
import { DeepReadonly, Quark, QuarkContext } from "./Types/Quark";
import { QuarkSelector, QuarkSelectors } from "./Types/Selectors";
import { Widen } from "./Types/Utilities";
import { createCachedSelector } from "./Utilities/CreateCachedSelector";
import { generateCustomActions } from "./Utilities/GenerateCustomActions";
import { generateCustomProcedures } from "./Utilities/GenerateCustomProcedures";
import { generateCustomSelectors } from "./Utilities/GenerateCustomSelectors";
import { generateSubscribeFunction } from "./Utilities/GenerateSubscribeFunction";
import { generateUseHook } from "./Utilities/GenerateUseHook";
import { getGlobalQuarkMiddlewares } from "./Utilities/GlobalMiddlewares";
import { isUpdateNecessary } from "./Utilities/IsUpdateNecessary";
import { registerQuark } from "./Utilities/QuarksCollection";
import { applyMiddlewares } from "./Utilities/StateUpdates/ApplyMiddlewares";
import { generateSetter } from "./Utilities/StateUpdates/GenerateSetter";

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
  ProcedureArgs extends any[] = never[],
>(
  initValue: T,
  config: QuarkConfig<Widen<T>, A, P, S, M> = {},
): Quark<Widen<T>, A, P, S, M> {
  const self: QuarkContext<T, GetMiddlewareTypes<M>> = {
    value: initValue,
    subscribers: new Set(),
    middlewares: config.middlewares ?? [],
    sideEffect: config.effect as any,
    configOptions: {
      allowRaceConditions: config.allowRaceConditions ?? false,
    },
    stateComparator: config.shouldUpdate ?? isUpdateNecessary,
    syncStoreSubscribe(callback: () => void) {
      self.subscribers.add(callback);
      return () => self.subscribers.delete(callback);
    },
  };

  self.middlewares.unshift(...getGlobalQuarkMiddlewares());

  const { set, bareboneSet, initiateProcedure, updateController } =
    generateSetter(self);

  const customActions = generateCustomActions(
    set,
    config?.actions ?? ({} as A),
  );

  const customProcedures = generateCustomProcedures(
    self,
    initiateProcedure,
    config?.procedures ?? ({} as P),
  );

  const selectors = Object.entries(config?.selectors ?? ({} as S)).map(
    ([key, selector]) => {
      return [key, createCachedSelector(selector)] as [
        keyof S,
        QuarkSelector<T, any>,
      ];
    },
  );

  const customSelectors = generateCustomSelectors(self, selectors);

  const get = () => self.value as DeepReadonly<T>;

  const use = generateUseHook(self, customActions, customProcedures, set);

  const subscribe = generateSubscribeFunction(self);

  const quark: Quark<T, A, P, S, M> = {
    set: set as any,
    get,
    use,
    subscribe,
    act: { ...customActions, ...customProcedures },
    select: customSelectors,
  };

  if (config.name !== undefined) {
    registerQuark(config.name, self);
  }

  applyMiddlewares(
    self,
    initValue,
    "sync",
    updateController.atomicUpdate(),
    bareboneSet,
  );

  return quark as any;
}
