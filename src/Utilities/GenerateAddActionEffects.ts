import type {
  ActionEffectBuilder,
  ParseActions,
  QuarkActionEffect,
  QuarkContext,
} from "../Types";

export const generateAddActionEffects = <
  T extends QuarkContext<any, any>,
  A extends ParseActions<any>
>(
  self: T,
  actions: A
) => {
  return (add: (builder: ActionEffectBuilder<T, A>) => void) => {
    const effects: [string, QuarkActionEffect<T>][] = [];

    const builder = Object.fromEntries(
      Object.entries(actions).map(([actionName]) => {
        const add = (effect: (currentState: T, previousState: T) => void) => {
          effects.push([actionName, effect]);
          return builder;
        };

        return [actionName, add];
      })
    ) as unknown as ActionEffectBuilder<T, A>;

    add(builder);

    self.actionEffects.push(...effects);

    return {
      remove() {
        for (const entry of effects) {
          self.actionEffects.splice(self.actionEffects.indexOf(entry), 1);
        }
      },
    };
  };
};
