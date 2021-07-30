import type { QuarkContext, QuarkEffects } from "../Quark.types";

/**
 * @internal
 */
export function initiateEffects<T>(
  self: QuarkContext<T, any>,
  effects: QuarkEffects<T, any>
) {
  for (const [_, effect] of Object.entries(effects)) {
    self.effects.add(effect);
  }
}
