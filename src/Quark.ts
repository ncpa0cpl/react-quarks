import { QuarkActions } from "./Types/Actions";
import { Config } from "./Types/Config";
import { QuarkMiddleware } from "./Types/Middlewares";
import { DeepReadonly, Quark, QuarkContext } from "./Types/Quark";
import { QuarkSelector, QuarkSelectors } from "./Types/Selectors";
import { Widen } from "./Types/Utilities";
import { createCachedSelector } from "./Utilities/CreateCachedSelector";
import { generateCustomActions } from "./Utilities/GenerateCustomActions";
import { generateCustomSelectors } from "./Utilities/GenerateCustomSelectors";
import { generateSubscribeFunction } from "./Utilities/GenerateSubscribeFunction";
import { generateUseHook } from "./Utilities/GenerateUseHook";
import { GlobalMiddlewareController } from "./Utilities/GlobalMiddlewares";
import { isUpdateNecessary } from "./Utilities/IsUpdateNecessary";
import { registerQuark } from "./Utilities/QuarksCollection";
import { createUpdateController } from "./Utilities/StateUpdates/AsyncUpdates";
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
  const A extends QuarkActions<T>,
  const S extends QuarkSelectors<T>,
  const M extends QuarkMiddleware<T>[],
>(
  initValue: T,
  config: Config<T, A, S, M> = {},
): Quark<Widen<T>, A, S> {
  const self: QuarkContext<T> = {
    value: initValue,
    subscribers: new Set(),
    immediateSubscribers: new Set(),
    mdInfo: (config.middlewares ?? []).map(m => ({ m, source: "own" })),
    middleware: null as any,
    sideEffect: config.effect as any,
    configOptions: {
      mode: config.mode ?? "queue",
    },
    stateComparator: config.shouldUpdate ?? isUpdateNecessary,
    syncStoreSubscribe(callback: () => void) {
      self.subscribers.add(callback);
      return () => self.subscribers.delete(callback);
    },
    actions: new Map(),
    updateController: null as any,
  };

  GlobalMiddlewareController.registerQuark(self);
  self.updateController = createUpdateController<T>(self);

  const {
    set,
    assign,
    unsafeSet,
  } = generateSetter(self);

  const customActions = generateCustomActions(
    self,
    unsafeSet,
    config?.actions ?? ({} as A),
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

  const use = generateUseHook(
    self,
    customActions,
    set,
    assign,
    unsafeSet,
  );

  const subscribe = generateSubscribeFunction(self);

  const quark: Quark<T, A, S> = {
    set: set as any,
    assign,
    unsafeSet,
    get,
    use,
    subscribe,
    act: customActions,
    select: customSelectors,
  };

  // @ts-expect-error
  quark.__context = self;

  if (config.name !== undefined) {
    registerQuark(config.name, self);
  }

  set(initValue);

  return quark as any;
}

export function getContext<T>(q: Quark<T, any, any>): QuarkContext<T> {
  // @ts-expect-error
  return q.__context;
}
