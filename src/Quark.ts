import type {
  ParseActions,
  ParseSelectors,
  Quark,
  QuarkActions,
  QuarkComparatorFn,
  QuarkContext,
  QuarkEffects,
  QuarkSelectors,
} from "./Quark.types";
import { generateCustomActions } from "./Utilities/GenerateCustomActions";
import { generateCustomSelectors } from "./Utilities/GenerateCustomSelectros";
import { generateSelectHook } from "./Utilities/GenerateSelectHook";
import { generateSetter } from "./Utilities/GenerateSetter";
import { generateUseHook } from "./Utilities/GenerateUseHook";
import { initiateEffects } from "./Utilities/InitiateEffects";
import { isUpdateNecessary } from "./Utilities/IsUpdateNecessary";

export function quark<
  T,
  ARGS extends any[],
  A extends QuarkActions<T, ARGS>,
  S extends QuarkSelectors<T>,
  E extends QuarkEffects<T, ParseActions<Exclude<A, undefined>>>
>(
  initValue: T,
  config: {
    shouldUpdate?: QuarkComparatorFn;
    actions?: A;
    selectors?: S;
  } = {},
  effects?: E
): Quark<
  T,
  {
    shouldUpdate: QuarkComparatorFn;
    actions: A;
    selectors: S;
    effects: E;
  }
> {
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
