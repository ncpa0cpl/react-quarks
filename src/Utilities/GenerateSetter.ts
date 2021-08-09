import type { InternalStateSetter, QuarkContext, StateSetter } from "../Types";
import { applyMiddlewares } from "./ApplyMiddlewares";
import { isGenerator } from "./IsGenerator";

/** @internal */
export function generateSetter<T, A, ET>(self: QuarkContext<T, A, ET>) {
  const rawSetter = (
    newVal: InternalStateSetter<T>,
    __internal_omit_render = false
  ) => {
    const newState = isGenerator(newVal) ? newVal(self.value) : newVal;
    const previousState = self.value;

    const shouldForceRender = self.stateComparator(self.value, newState);

    self.value = newState;

    if (shouldForceRender) {
      self.effects.forEach((e) =>
        e(previousState, newState, {
          ...(self.customActions as A),
          set: (v) => rawSetter(v, true),
        })
      );
      if (!__internal_omit_render) self.subscribers.forEach((s) => s(self.value));
    }
  };

  const setterWithMiddlewares = (newVal: StateSetter<T, ET>) => {
    applyMiddlewares(self, newVal, rawSetter);
  };

  return { setterWithMiddlewares, rawSetter };
}
