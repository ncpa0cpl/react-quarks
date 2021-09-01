import React from "react";
import type {
  InternalQuarkSetterFn,
  QuarkComparatorFn,
  QuarkContext,
  QuarkSelector,
  QuarkSetterFn,
} from "../../Types";
import { applySelector } from "./ApplySelector";
import { updateStateWithSelector } from "./UpdateStateWithSelector";

/** @internal */
export function generateSelectHook<T, A, ET>(
  self: QuarkContext<T, A, ET>,
  setter: QuarkSetterFn<T, ET>
) {
  return <U>(
    selector: QuarkSelector<T, U>,
    shouldComponentUpdate?: QuarkComparatorFn
  ) => {
    const [, forceRender] = React.useReducer((s: number) => s + 1, 0);
    const initVal = React.useMemo(() => applySelector(self.value, selector), []);
    const selectedValue = React.useRef<U>(initVal);

    const get = () => selectedValue.current;

    const set: InternalQuarkSetterFn<U> = (v) =>
      updateStateWithSelector(setter, selector, v);

    React.useEffect(() => {
      const stateComparator = shouldComponentUpdate ?? ((a, b) => !Object.is(a, b));

      const sv = applySelector(self.value, selector);

      if (stateComparator(sv, selectedValue.current)) {
        selectedValue.current = sv;
        forceRender();
      }
    }, [selector]);

    React.useEffect(() => {
      const stateComparator = shouldComponentUpdate ?? ((a, b) => !Object.is(a, b));

      const onValueChange = (newVal: T) => {
        const sv = applySelector(newVal, selector);
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
      set,
    };
  };
}
