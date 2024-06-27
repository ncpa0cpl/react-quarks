import type { QuarkContext, SetStateAction } from "../../Types";

/**
 * Run all the necessary action after the state has changed, propagate the
 * effects and send events to the subscribers if necessary.
 *
 * @internal
 */
export function processStateUpdate<T, ET>(params: {
  self: QuarkContext<T, ET>;
  previousState: T;
  applyMiddlewaresAndUpdateState: (v: SetStateAction<T, ET>) => void;
  debounceEvent: (eventAction: () => void) => void;
}) {
  const { previousState, self, applyMiddlewaresAndUpdateState, debounceEvent } =
    params;

  const shouldUpdate = self.stateComparator(self.value, previousState);

  if (shouldUpdate) {
    try {
      if (self.sideEffect) {
        self.sideEffect(
          previousState,
          self.value,
          applyMiddlewaresAndUpdateState,
        );
      }
    } finally {
      debounceEvent(() => {
        for (const subscriber of self.subscribers) {
          try {
            subscriber(self.value);
          } catch (err) {
            console.error(
              `One of the Quark subscribers returned with an error (${subscriber.name}):`,
              err
            );
          }
        }
      });
    }
  }
}
