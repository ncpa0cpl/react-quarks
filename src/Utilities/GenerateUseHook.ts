import React from "react";
import type {
  ParseActions,
  QuarkContext,
  QuarkGetterFn,
  QuarkSetterFn,
} from "../Quark.types";

/**
 * @internal
 */
export function generateUseHook<T, A extends ParseActions<any>>(
  self: QuarkContext<T, A>,
  set: QuarkSetterFn<T>,
  get: QuarkGetterFn<T>
) {
  return () => {
    const [, forceRender] = React.useReducer((s: number) => s + 1, 0);

    React.useEffect(() => {
      const onValueChange = () => forceRender();

      self.subscribers.add(onValueChange);

      return () => {
        self.subscribers.delete(onValueChange);
      };
    }, []);

    return {
      get,
      set,
      ...((self.customActions as A) ?? ({} as A)),
    };
  };
}
