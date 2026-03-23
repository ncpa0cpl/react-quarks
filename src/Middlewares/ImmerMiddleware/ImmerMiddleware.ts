import {
  enableArrayMethods,
  enableMapSet,
  enablePatches,
  Immer,
  isDraft,
  original,
} from "immer";
import { QuarkMiddleware } from "../../Types/Middlewares";

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
  /**
   * Pass false to use loose iteration that only processes enumerable string properties.
   * This skips symbols and non-enumerable properties for maximum performance.
   *
   * By default, strict iteration is enabled (includes all own properties).
   *
   * This option does not change the global immer settings.
   */
  strictIteration?: boolean;
  /**
   * Enables optimized array method handling for Immer drafts.
   *
   * This plugin overrides array methods to avoid unnecessary Proxy creation during iteration,
   * significantly improving performance for array-heavy operations.
   *
   * **Mutating methods** (push, pop, shift, unshift, splice, sort, reverse):
   * Operate directly on the copy without creating per-element proxies.
   *
   * **Non-mutating methods** fall into categories:
   * - **Subset operations** (filter, slice, find, findLast): Return draft proxies - mutations track
   * - **Transform operations** (concat, flat): Return base values - mutations don't track
   * - **Primitive-returning** (indexOf, includes, some, every, etc.): Return primitives
   *
   * **Important**: Callbacks for overridden methods receive base values, not drafts.
   * This is the core performance optimization.
   *
   * This option changes the global immer settings.
   *
   * @example
   * ```ts
   * import { enableArrayMethods, produce } from "immer"
   *
   * enableArrayMethods()
   *
   * const next = produce(state, draft => {
   *   // Optimized - no proxy creation per element
   *   draft.items.sort((a, b) => a.value - b.value)
   *
   *   // filter returns drafts - mutations propagate
   *   const filtered = draft.items.filter(x => x.value > 5)
   *   filtered[0].value = 999 // Affects draft.items[originalIndex]
   * })
   * ```
   *
   * @see https://immerjs.github.io/immer/array-methods
   */
  arrayMethods?: boolean;
}): QuarkMiddleware<any> => {
  const immer = new Immer();

  if (options?.mapAndSetSupport) {
    enableMapSet();
  }

  if (options?.patches) {
    enablePatches();
  }

  if (options?.arrayMethods == true) {
    enableArrayMethods();
  }

  if (options?.strictShallowCopy != null) {
    immer.setUseStrictShallowCopy(options?.strictShallowCopy);
  }

  if (options?.autoFreeze != null) {
    immer.setAutoFreeze(options.autoFreeze);
  }

  if (options?.strictIteration != null) {
    immer.setUseStrictIteration(options?.strictIteration);
  }

  return {
    onFunction(ctx) {
      const action = ctx.action;
      return ctx.next(currentState => {
        if (typeof currentState !== "object" || currentState === null) {
          return action(currentState);
        }

        const draft = immer.createDraft(currentState);

        const actionResult = action(draft);

        if (isDraft(actionResult)) {
          try {
            return immer.finishDraft(actionResult);
          } catch (err) {
            console.error(actionResult);
            console.error(action.toString());

            throw err;
          }
        }

        if (actionResult instanceof Promise) {
          return actionResult.then(result => {
            if (isDraft(result)) {
              return immer.finishDraft(result);
            }

            return unpackNestedDrafts(result);
          });
        }

        return unpackNestedDrafts(actionResult);
      });
    },
    onValue(ctx) {
      if (isDraft(ctx.action)) {
        return ctx.next(immer.finishDraft(ctx.action));
      } else {
        return ctx.next(unpackNestedDrafts(ctx.action));
      }
    },
  };
};

// @ts-expect-error
const objPrototype = {}.__proto__;

const alreadyUnpacked = new WeakSet<any>();
function unpackNestedDrafts<T = unknown>(
  v: T,
): T {
  if (
    typeof v === "object"
    && v != null
    // @ts-expect-error
    && (v.__proto__ === objPrototype || Array.isArray(v))
  ) {
    if (Object.isFrozen(v)) {
      return v;
    }

    if (alreadyUnpacked.has(v)) {
      return v;
    }
    alreadyUnpacked.add(v);

    const keys = Object.keys(v) as Array<keyof typeof v>;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!;

      if (isDraft(v[key])) {
        v[key] = original(v[key])!;
      }

      v[key] = unpackNestedDrafts(v[key])!;
    }
  }

  return v;
}
