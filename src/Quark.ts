import type {
  ParseActions,
  ParseSelectors,
  Quark,
  QuarkActions,
  QuarkConfig,
  QuarkContext,
  QuarkEffects,
  QuarkObjectOptions,
  QuarkSelectors,
} from "./Quark.types";
import { generateCustomActions } from "./Utilities/GenerateCustomActions";
import { generateCustomSelectors } from "./Utilities/GenerateCustomSelectros";
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
  E extends QuarkEffects<T, ParseActions<Exclude<A, undefined>>>
>(
  initValue: T,
  config: QuarkConfig<A, S> = {},
  effects?: E
): Quark<T, QuarkObjectOptions<A, S, E>> {
  const self: QuarkContext<T, ParseActions<A>> = {
    value: initValue,
    effects: new Set(),
    subscribers: new Set(),
    customActions: undefined,

    stateComparator: config.shouldUpdate ?? isUpdateNecessary,
  };

  const set = generateSetter(self);

  const customActions = generateCustomActions(
    self,
    set,
    config?.actions ?? {}
  ) as ParseActions<A>;
  self.customActions = customActions;

  const customSelectors = generateCustomSelectors(
    self,
    config?.selectors ?? {}
  ) as ParseSelectors<S>;

  const get = () => self.value;

  const use = generateUseHook(self, set, get);

  const useSelector = generateSelectHook(self);

  initiateEffects(self, effects ?? {});

  return {
    get,
    set,
    use,
    useSelector,
    ...customActions,
    ...customSelectors,
  };
}
