import React from "react";
import type { QuarkContext, QuarkCustomSelector, QuarkSelectors } from "../Types";

/** @internal */
function generateCustomSelectHook<T, U, ET, ARGS extends any[]>(
  self: QuarkContext<T, any, ET>,
  selector: QuarkCustomSelector<T, ARGS, U>
) {
  return (...args: ARGS) => {
    const [, forceRender] = React.useReducer((s: number) => s + 1, 0);

    const initVal = React.useMemo(() => selector(self.value, ...args), []);
    const selectedValue = React.useRef(initVal);

    const get = () => selectedValue.current;

    React.useEffect(() => {
      const stateComparator = (a: U, b: U) => !Object.is(a, b);

      const onValueChange = (newVal: T) => {
        const sv = selector(newVal, ...args);
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
    };
  };
}

/** @internal */
export function generateCustomSelectors<T, ET, ARGS extends any[]>(
  self: QuarkContext<T, any, ET>,
  selectors: QuarkSelectors<T, ARGS>
) {
  return Object.fromEntries(
    Object.entries(selectors).map(([selectorName, selectorMethod]) => {
      const wrappedSelector = generateCustomSelectHook(self, selectorMethod);
      return [selectorName, wrappedSelector];
    })
  );
}
