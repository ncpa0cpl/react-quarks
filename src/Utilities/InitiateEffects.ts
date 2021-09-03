import type { QuarkContext, QuarkEffects } from "../Types";

/**
 * Adds the provided effects to the Quark Context.
 *
 * @internal
 */
export function initiateEffects<T, ET>(
  self: QuarkContext<T, any, ET>,
  effects: QuarkEffects<T, any, ET>
) {
  for (const [_, effect] of Object.entries(effects)) {
    self.effects.add(effect);
  }
}
