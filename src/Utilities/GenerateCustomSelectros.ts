import React from "react";
import type {
  QuarkComparatorFn,
  QuarkContext,
  QuarkCustomSelector,
  QuarkSelectors,
} from "../Quark.types";

/**
 * @internal
 */
function generateCustomSelectHook<T, U>(
  self: QuarkContext<T, any>,
  selector: QuarkCustomSelector<T, U>
) {
  return (shouldComponentUpdate?: QuarkComparatorFn) => {
    const [, forceRender] = React.useReducer((s: number) => s + 1, 0);

    const initVal = React.useMemo(() => selector(self.value), []);
    const selectedValue = React.useRef(initVal);

    const get = () => selectedValue.current;

    React.useEffect(() => {
      const stateComparator = shouldComponentUpdate ?? ((a, b) => !Object.is(a, b));

      const onValueChange = (newVal: T) => {
        const sv = selector(newVal);
        if (stateComparator(sv, selectedValue.current)) {
          selectedValue.current = sv;
          forceRender();
        }
      };

      self.subscribers.add(onValueChange);

      return () => {
        self.subscribers.delete(onValueChange);
      };
    }, [shouldComponentUpdate]);

    return {
      get,
    };
  };
}

/**
 * @internal
 */
export function generateCustomSelectors<T>(
  self: QuarkContext<T, any>,
  selectors: QuarkSelectors<T>
) {
  return Object.fromEntries(
    Object.entries(selectors).map(([selectorName, selectorMethod]) => {
      const wrappedSelector = generateCustomSelectHook(self, selectorMethod);
      return [selectorName, wrappedSelector];
    })
  );
}
