import React from "react";
import type { QuarkComparatorFn, QuarkContext, QuarkSelector } from "../Types";

/**
 * Generate a 'selector' React Hook for this Quark.
 *
 * Selector hook allows for selecting part of the state and subscribing to it's changes.
 *
 * @param self Context of the Quark in question
 * @internal
 */
export function generateSelectHook<T, A, ET>(self: QuarkContext<T, A, ET>) {
  return <U>(
    selector: QuarkSelector<T, U>,
    shouldComponentUpdate?: QuarkComparatorFn
  ) => {
    const [, forceRender] = React.useReducer((s: number) => s + 1, 0);
    const initVal = React.useMemo(() => selector(self.value), []);
    const selectedValue = React.useRef<U>(initVal);

    const get = () => selectedValue.current;

    React.useEffect(() => {
      const stateComparator = shouldComponentUpdate ?? ((a, b) => !Object.is(a, b));

      const sv = selector(self.value);

      if (stateComparator(sv, selectedValue.current)) {
        selectedValue.current = sv;
        forceRender();
      }
    }, [selector]);

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
    }, [selector, shouldComponentUpdate]);

    return {
      get,
    };
  };
}
