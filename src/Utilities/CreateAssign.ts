import { isDraft, produce } from "immer";
import { QuarkAssignFn, QuarkSetResult, SetStateAction } from "../Types/Quark";

export function createAssign<T, R>(
  actionSet: (action: SetStateAction<T>) => R,
): QuarkAssignFn<T> {
  const assign = <U extends object>(
    ...args: [patch: Partial<T>] | [
      select: (state: T) => U,
      patch: Partial<U>,
    ] | [
      select: (state: T) => U,
      patchGenerator: (u: U) => void,
    ]
  ) => {
    if (args.length === 2) {
      const [selector, patch] = args;

      if (typeof patch === "function") {
        return actionSet(current => {
          if (isDraft(current)) {
            let s = selector(current);
            patch(s);
            return current;
          }

          const newValue = produce(current, draft => {
            const s = selector(draft as T);
            patch(s);
            return draft;
          });
          return newValue;
        }) as QuarkSetResult<T>;
      }

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

  return assign;
}
