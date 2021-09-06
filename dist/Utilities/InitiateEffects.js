/**
 * Adds the provided effects to the Quark Context.
 *
 * @internal
 */
export function initiateEffects(self, effects) {
    for (const [_, effect] of Object.entries(effects)) {
        self.effects.add(effect);
    }
}
