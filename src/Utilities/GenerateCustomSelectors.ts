import React from "react";
import type {
  ParseSelectors,
  QuarkContext,
  QuarkCustomSelector,
  QuarkSelectors,
} from "../Types";

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

/**
 * Generate `selector` React Hooks based on the selectors defined in the Quark config.
 *
 * @param self Context of the Quark in question
 * @param selectors An object containing selector definitions, each selector must be
 *   a function accepting the Quark state value in it's first argument
 * @returns An object with the same structure as `selectors` but each method it
 *   contains is a React Hook
 * @internal
 */
export function generateCustomSelectors<T, ET, S extends QuarkSelectors<T, any>>(
  self: QuarkContext<T, any, ET>,
  selectors: S
): ParseSelectors<S> {
  return Object.fromEntries(
    Object.entries(selectors).map(([selectorName, selectorMethod]) => {
      const wrappedSelector = generateCustomSelectHook(self, selectorMethod);
      return [selectorName, wrappedSelector];
    })
  ) as unknown as ParseSelectors<S>;
}
