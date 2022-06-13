import { createDraft, enableES5, enableMapSet, finishDraft, isDraft } from "immer";
import type { QuarkMiddleware } from "../../Types";

export const createImmerMiddleware = (options?: {
  es5support?: boolean;
  mapAndSetSupport?: boolean;
}): QuarkMiddleware<any, undefined> => {
  if (options?.es5support) {
    enableES5();
  }

  if (options?.mapAndSetSupport) {
    enableMapSet();
  }

  return (getState, action, resume) => {
    if (isDraft(action)) {
      return resume(finishDraft(action));
    }

    if (typeof action === "function") {
      const current = getState();
      if (typeof current !== "object" || current === null) return resume(action);

      const draft = createDraft(current);

      const actionResult = action(draft);

      if (isDraft(actionResult)) {
        return resume(finishDraft(actionResult));
      }

      return resume(actionResult);
    }

    return resume(action);
  };
};
