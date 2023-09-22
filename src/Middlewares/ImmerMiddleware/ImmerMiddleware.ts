import { enableMapSet, enablePatches, Immer, isDraft } from "immer";
import type { QuarkMiddleware } from "../../Types";

export const createImmerMiddleware = (options?: {
  /**
   * When true, enables immer support for Map and Set globally.
   */
  mapAndSetSupport?: boolean;
  /**
   * When true, enables immer's patches globally.
   */
  patches?: boolean;
  /**
   * Pass true to enable strict shallow copy of this specific middleware.
   *
   * By default, immer does not copy the object descriptors such as getter,
   * setter and non-enumrable properties.
   *
   * This option does not change the global immer settings.
   */
  strictShallowCopy?: boolean;
  /**
   * Pass true to automatically freeze all copies created by Immer within this
   * middleware.
   *
   * By default, auto-freezing is enabled.
   *
   * This option does not change the global immer settings.
   */
  autoFreeze?: boolean;
}): QuarkMiddleware<any, undefined> => {
  const immer = new Immer();

  if (options?.mapAndSetSupport) {
    enableMapSet();
  }

  if (options?.patches) {
    enablePatches();
  }

  if (options?.strictShallowCopy != null) {
    immer.setUseStrictShallowCopy(options?.strictShallowCopy);
  }

  if (options?.autoFreeze != null) {
    immer.setAutoFreeze(options.autoFreeze);
  }

  return (_, action, resume) => {
    if (isDraft(action)) {
      return resume(immer.finishDraft(action));
    }

    if (typeof action === "function") {
      return resume((currentState: object) => {
        if (typeof currentState !== "object" || currentState === null)
          return action(currentState);

        const draft = immer.createDraft(currentState);

        const actionResult = action(draft);

        if (isDraft(actionResult)) {
          return immer.finishDraft(actionResult);
        }

        return actionResult;
      });
    }

    return resume(action);
  };
};
