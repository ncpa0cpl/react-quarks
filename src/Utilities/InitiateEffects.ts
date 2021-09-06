import type { QuarkContext, QuarkEffects } from "../Types";

/**
 * Adds the provided effects to the Quark Context.
 *
 * @internal
 */
export function initiateEffects<T, ET>(
  self: QuarkContext<T, ET>,
  effects: QuarkEffects<T, ET>
) {
  for (const [_, effect] of Object.entries(effects)) {
    self.effects.add(effect);
  }
}
