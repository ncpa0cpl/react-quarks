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

  return (_, action, resume) => {
    if (isDraft(action)) {
      return resume(finishDraft(action));
    }

    if (typeof action === "function") {
      return resume((currentState: object) => {
        if (typeof currentState !== "object" || currentState === null)
          return action(currentState);

        const draft = createDraft(currentState);

        const actionResult = action(draft);

        if (isDraft(actionResult)) {
          return finishDraft(actionResult);
        }

        return actionResult;
      });
    }

    return resume(action);
  };
};
