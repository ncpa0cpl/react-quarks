import type { QuarkContext, SetStateAction } from "../../Types";

/**
 * Run all the necessary action after the state has changed, propagate the effects
 * and send events to the subscribers if necessary.
 *
 * @internal
 */
export function processStateUpdate<T, ET>(params: {
  self: QuarkContext<T, ET>;
  previousState: T;
  actionName?: string;
  applyMiddlewaresAndUpdateState: (v: SetStateAction<T, ET>) => void;
  dispatchEvent: (eventAction: () => void) => void;
}) {
  const { previousState, self, applyMiddlewaresAndUpdateState, dispatchEvent } =
    params;

  const currentState = self.value;

  const shouldUpdate = self.stateComparator(currentState, previousState);

  const subscribers = new Set(self.subscribers);
  const actionEffects = new Map(self.actionEffects);

  const notifySubscribers = () => {
    for (const subscriber of subscribers) {
      subscriber(currentState);
    }
  };

  if (shouldUpdate) {
    for (const [actionName, effect] of actionEffects) {
      if (actionName === params.actionName) {
        effect(currentState, previousState);
      }
    }

    if (self.sideEffect) {
      self.sideEffect(previousState, currentState, applyMiddlewaresAndUpdateState);
    }

    dispatchEvent(() => {
      notifySubscribers();
    });
  }
}
