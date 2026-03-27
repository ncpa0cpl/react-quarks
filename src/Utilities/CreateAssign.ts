import { isDraft, produce } from "immer";
import { QuarkAssignFn, QuarkSetResult, SetStateAction } from "../Types/Quark";

export function createAssign<T, R>(
  actionSet: (action: SetStateAction<T>) => R,
): QuarkAssignFn<T> {
  return (...args: Parameters<QuarkAssignFn<T>>) => {
    if (args.length === 2) {
      const [selector, patch] = args;

      return actionSet(current => {
        if (isDraft(current)) {
          const s = selector(current);
          Object.assign(s, patch);
          return current;
        }

        const newValue = produce(current, draft => {
          const s = selector(draft as T);
          Object.assign(s, patch);
          return draft;
        });
        return newValue;
      }) as QuarkSetResult<T>;
    }

    const [patch] = args;
    return actionSet((state) => {
      if (isDraft(state)) {
        Object.assign(state as object, patch);
        return state;
      }

      const newValue = Object.assign({ ...state as object }, patch);
      return newValue as T;
    }) as QuarkSetResult<T>;
  };
}
