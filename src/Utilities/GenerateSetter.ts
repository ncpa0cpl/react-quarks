import type { QuarkContext, StateSetter } from "../Types";
import { applyMiddlewares } from "./ApplyMiddlewares";
import { createCancelableMethod } from "./CancelableMethod";
import { isGenerator } from "./IsGenerator";

/** @internal */
export function generateSetter<T, A, ET>(self: QuarkContext<T, A, ET>) {
  const asyncUpdates: Array<() => void> = [];

  const cancelPreviousUpdates = () => {
    while (asyncUpdates.length > 0) {
      const cancel = asyncUpdates.pop();
      if (cancel) cancel();
    }
  };

  const rawSetter = (newState: T, __internal_omit_render = false) => {
    const previousState = self.value;

    const shouldForceRender = self.stateComparator(self.value, newState);

    self.value = newState;

    if (shouldForceRender) {
      self.effects.forEach((e) =>
        e(previousState, newState, {
          ...(self.customActions as A),
          set: (v) => setterWithMiddlewares(v as StateSetter<T, ET>, true),
        })
      );
      if (!__internal_omit_render) self.subscribers.forEach((s) => s(self.value));
    }
  };

  const setterWithMiddlewares = (
    newVal: StateSetter<T, ET>,
    __internal_omit_render = false
  ) => {
    cancelPreviousUpdates();

    const newState = isGenerator(newVal) ? newVal(self.value) : newVal;

    if (newState instanceof Promise) {
      const [onPromiseFinish, cancel] = createCancelableMethod((v: T) => {
        applyMiddlewares(self, v, (v) => rawSetter(v, __internal_omit_render));
      });
      asyncUpdates.push(cancel);
      newState.then(onPromiseFinish).catch((e) => {
        console.error(e);
      });
    } else {
      applyMiddlewares(self, newState as T | ET, (v) =>
        rawSetter(v, __internal_omit_render)
      );
    }
  };

  return { setterWithMiddlewares, rawSetter };
}
