import { QuarkContext } from "../../Types/Quark";
import { DispatchAction } from "./ApplyMiddlewares";
import { AtomicUpdate } from "./AsyncUpdates";
import { Immediate } from "./Immediate";
import { resolveUpdateType } from "./ResolveUpdateType";
import { unpackAction } from "./UnpackAction";

function notifySubscribers<T>(
  self: QuarkContext<T>,
  debounceEvent: (eventAction: () => void) => void,
) {
  for (const subscriber of self.immediateSubscribers) {
    try {
      subscriber(self.value);
    } catch (err) {
      console.error(
        `One of the Quark subscribers returned with an error (${subscriber.name}):`,
        err,
      );
    }
  }

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
  actionState: T;
  update: AtomicUpdate<T>;
  debounceEvent: (eventAction: () => void) => void;
}) {
  const { previousState, self, update, debounceEvent, actionState } = params;

  const shouldUpdate = self.stateComparator(previousState, self.value);

  if (shouldUpdate) {
    const effectPromises: Promise<any>[] = [];
    try {
      if (self.sideEffect) {
        self.sideEffect(
          previousState,
          self.value,
          action => {
            const type = resolveUpdateType(action);
            const dispatch = new DispatchAction<T, any>(
              self,
              update,
              type,
              self.middleware,
              action,
            );

            const p = unpackAction(dispatch, (s) => {
              self.value = s;
              return Immediate.resolve(self.value);
            });

            if (p instanceof Promise) {
              effectPromises.push(p);
            }

            return p;
          },
        );
      }
    } finally {
      if (effectPromises.length > 0) {
        return Promise.all(effectPromises)
          .then(() => actionState)
          .finally(() => {
            notifySubscribers(self, debounceEvent);
          });
      } else {
        notifySubscribers(self, debounceEvent);
      }
    }
  }

  return actionState;
}
