import { QuarkContext } from "../../Types/Quark";
import { applyMiddlewares } from "./ApplyMiddlewares";
import { AtomicUpdate } from "./AsyncUpdates";
import { resolveUpdateType } from "./ResolveUpdateType";
import { unpackAction } from "./UnpackAction";

function notifySubscribers<T>(
  self: QuarkContext<T>,
  debounceEvent: (eventAction: () => void) => void,
) {
  return debounceEvent(() => {
    for (const subscriber of self.subscribers) {
      try {
        subscriber(self.value);
      } catch (err) {
        console.error(
          `One of the Quark subscribers returned with an error (${subscriber.name}):`,
          err,
        );
      }
    }
  });
}
/**
 * Run all the necessary action after the state has changed, propagate the
 * effects and send events to the subscribers if necessary.
 *
 * @internal
 */
export function processStateUpdate<T>(params: {
  self: QuarkContext<T>;
  previousState: T;
  update: AtomicUpdate<T>;
  debounceEvent: (eventAction: () => void) => void;
}) {
  const { previousState, self, update, debounceEvent } = params;

  const shouldUpdate = self.stateComparator(self.value, previousState);

  if (shouldUpdate) {
    const effectPromises: Promise<any>[] = [];
    try {
      if (self.sideEffect) {
        self.sideEffect(
          previousState,
          self.value,
          action => {
            const type = resolveUpdateType(action);
            const p = applyMiddlewares(
              self,
              action,
              type,
              update,
              (action2) =>
                unpackAction(self, update, action2, (s) => {
                  self.value = s;
                }),
            );

            if (p instanceof Promise) {
              effectPromises.push(p);
            }

            return p;
          },
        );
      }
    } finally {
      if (effectPromises.length > 0) {
        return Promise.all(effectPromises).finally(() => {
          notifySubscribers(self, debounceEvent);
        });
      } else {
        notifySubscribers(self, debounceEvent);
      }
    }
  }
}
