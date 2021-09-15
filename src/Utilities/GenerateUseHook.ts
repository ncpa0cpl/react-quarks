import React from "react";
import type {
  ParseActions,
  QuarkContext,
  QuarkGetterFn,
  QuarkSetterFn,
} from "../Types";

/**
 * Generate the react hook for this specific quark.
 *
 * @param self Context of the Quark in question
 * @param set Function allowing for updating the current state of the Quark
 * @param get Function that resolves the Quark state value
 * @returns A React Hook function exposing this quark state and actions
 * @internal
 */
export function generateUseHook<T, A extends ParseActions<any>, ET>(
  self: QuarkContext<T, ET>,
  actions: A,
  set: QuarkSetterFn<T, ET>,
  get: QuarkGetterFn<T>
) {
  return () => {
    const [, forceRender] = React.useReducer((s: number) => s + 1, 0);

    React.useEffect(() => {
      const context = {
        reRender() {
          forceRender();
        },
      };

      const onValueChange = () => context.reRender();

      self.subscribers.add(onValueChange);

      return () => {
        context.reRender = () => {};
        self.subscribers.delete(onValueChange);
      };
    }, []);

    return {
      get,
      set,
      ...actions,
    };
  };
}
