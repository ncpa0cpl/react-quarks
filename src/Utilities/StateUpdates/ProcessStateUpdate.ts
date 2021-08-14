import type { QuarkContext, StateSetter } from "../../Types";

export function processStateUpdate<T, A, ET>(params: {
  self: QuarkContext<T, A, ET>;
  previousState: T;
  omitNotifyingSubscribers: boolean;
  updateStateWithMiddlewares: (v: StateSetter<T, ET>) => void;
}) {
  const {
    omitNotifyingSubscribers,
    previousState,
    self,
    updateStateWithMiddlewares,
  } = params;

  const shouldUpdate = self.stateComparator(self.value, previousState);

  const propagateSideEffects = () => {
    const actions = {
      ...(self.customActions as A),
      set: updateStateWithMiddlewares,
    };

    for (const sideEffect of self.effects) {
      sideEffect(previousState, self.value, actions);
    }
  };

  const notifySubscribers = () => {
    for (const subscriber of self.subscribers) {
      subscriber(self.value);
    }
  };

  if (shouldUpdate) {
    propagateSideEffects();
    if (!omitNotifyingSubscribers) notifySubscribers();
  }
}
