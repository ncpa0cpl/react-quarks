import React from "react";
import type { QuarkContext, QuarkSelector } from "../Types";

/**
 * Generate a 'selector' React Hook for this Quark.
 *
 * Selector hook allows for selecting part of the state and subscribing to it's changes.
 *
 * @param self Context of the Quark in question
 * @internal
 */
export function generateSelectHook<T, ET>(self: QuarkContext<T, ET>) {
  return <ARGS extends any[], R>(
    selector: QuarkSelector<T, ARGS, R>,
    ...args: ARGS
  ) => {
    const [, forceRender] = React.useReducer((s: number) => s + 1, 0);

    const [initVal] = React.useState(() => selector(self.value, ...args));
    const selectedValue = React.useRef(initVal);

    const get = () => selectedValue.current;

    React.useEffect(() => {
      const onValueChange = (newVal: T) => {
        const sv = selector(newVal, ...args);
        if (!Object.is(sv, selectedValue.current)) {
          selectedValue.current = sv;
          forceRender();
        }
      };

      onValueChange(self.value);

      self.subscribers.add(onValueChange);
      return () => {
        self.subscribers.delete(onValueChange);
      };
    }, [selector, ...args]);

    return {
      get,
    };
  };
}
