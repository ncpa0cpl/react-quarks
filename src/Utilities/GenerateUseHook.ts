import React from "react";
import type {
  ParseActions,
  QuarkContext,
  QuarkGetterFn,
  QuarkSetterFn,
} from "../Types";

/** @internal */
export function generateUseHook<T, A extends ParseActions<any>, ET>(
  self: QuarkContext<T, A, ET>,
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
