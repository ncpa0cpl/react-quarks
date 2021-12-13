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
  applyMiddlewaresAndUpdateState: (v: SetStateAction<T, ET>) => void;
  dispatchEvent: (eventAction: () => void) => void;
}) {
  const { previousState, self, applyMiddlewaresAndUpdateState, dispatchEvent } =
    params;

  const shouldUpdate = self.stateComparator(self.value, previousState);

  const subscribers = new Set(self.subscribers);

  const notifySubscribers = () => {
    for (const subscriber of subscribers) {
      subscriber(self.value);
    }
  };

  if (shouldUpdate) {
    if (self.sideEffect) {
      self.sideEffect(previousState, self.value, applyMiddlewaresAndUpdateState);
    }

    dispatchEvent(() => {
      notifySubscribers();
    });
  }
}
