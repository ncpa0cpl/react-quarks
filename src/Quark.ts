import type {
  GetMiddlewareTypes,
  ParseActions,
  ParseSelectors,
  Quark,
  QuarkActions,
  QuarkConfig,
  QuarkContext,
  QuarkEffects,
  QuarkMiddleware,
  QuarkObjectOptions,
  QuarkSelectors,
} from "./Types";
import { generateCustomActions } from "./Utilities/GenerateCustomActions";
import { generateCustomSelectors } from "./Utilities/GenerateCustomSelectors";
import { generateSelectHook } from "./Utilities/GenerateSelectHook";
import { generateSetter } from "./Utilities/GenerateSetter";
import { generateUseHook } from "./Utilities/GenerateUseHook";
import { initiateEffects } from "./Utilities/InitiateEffects";
import { isUpdateNecessary } from "./Utilities/IsUpdateNecessary";

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
  ARGS extends any[],
  A extends QuarkActions<T, ARGS>,
  S extends QuarkSelectors<T>,
  M extends QuarkMiddleware<T, any>[],
  E extends QuarkEffects<T, ParseActions<Exclude<A, undefined>>>
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
  };

  const { setterWithMiddlewares } = generateSetter(self);

  const customActions = generateCustomActions(
    self,
    setterWithMiddlewares,
    config?.actions ?? {}
  ) as ParseActions<A>;
  self.customActions = customActions;

  const customSelectors = generateCustomSelectors(
    self,
    config?.selectors ?? {}
  ) as ParseSelectors<S>;

  const get = () => self.value;

  const use = generateUseHook(self, setterWithMiddlewares, get);

  const useSelector = generateSelectHook(self);

  initiateEffects(self, effects ?? {});

  return {
    get,
    set: setterWithMiddlewares,
    use,
    useSelector,
    ...customActions,
    ...customSelectors,
  };
}
