import React from "react";
import type {
  InternalQuarkSetterFn,
  QuarkContext,
  QuarkCustomSelector,
  QuarkSelectors,
  QuarkSetterFn,
} from "../../Types";
import { applyCustomSelector } from "./ApplySelector";
import { updateStateWithSelector } from "./UpdateStateWithSelector";

/** @internal */
function generateCustomSelectHook<T, U, ET, ARGS extends any[]>(
  self: QuarkContext<T, any, ET>,
  setter: QuarkSetterFn<T, ET>,
  selector: QuarkCustomSelector<T, ARGS, U>
) {
  return (...args: ARGS) => {
    const [, forceRender] = React.useReducer((s: number) => s + 1, 0);

    const initVal = React.useMemo(
      () => applyCustomSelector(self.value, selector, ...args),
      []
    );
    const selectedValue = React.useRef(initVal);

    const get = () => selectedValue.current;

    const set: InternalQuarkSetterFn<U> = (v) =>
      updateStateWithSelector(setter, (s) => selector(s, ...args), v);

    React.useEffect(() => {
      const stateComparator = (a: U, b: U) => !Object.is(a, b);

      const onValueChange = (newVal: T) => {
        const sv = applyCustomSelector(newVal, selector, ...args);
        if (stateComparator(sv, selectedValue.current)) {
          selectedValue.current = sv;
          forceRender();
        }
      };

      onValueChange(self.value);

      self.subscribers.add(onValueChange);

      return () => {
        self.subscribers.delete(onValueChange);
      };
    }, args);

    return {
      get,
      set,
    };
  };
}

/** @internal */
export function generateCustomSelectors<T, ET, ARGS extends any[]>(
  self: QuarkContext<T, any, ET>,
  setter: QuarkSetterFn<T, ET>,
  selectors: QuarkSelectors<T, ARGS>
) {
  return Object.fromEntries(
    Object.entries(selectors).map(([selectorName, selectorMethod]) => {
      const wrappedSelector = generateCustomSelectHook(self, setter, selectorMethod);
      return [selectorName, wrappedSelector];
    })
  );
}
