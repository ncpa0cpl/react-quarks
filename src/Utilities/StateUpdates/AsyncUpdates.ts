import { QuarkContext } from "../../Types/Quark";

/**
 * Controller responsible for managing asynchronous updates. By default all and
 * any dispatched updates cause any previous non resolved updates to be
 * canceled. This prevents occurrence of race conditions between the dispatched
 * updates.
 *
 * @internal
 */
export type UpdateController<T> = {
  atomicUpdate(): AtomicUpdater<T>;
  unsafeUpdate(): AtomicUpdater<T>;
  currentUpdate(): AtomicUpdater<T> | undefined;
};

export type AtomicUpdater<T> = {
  update(action: T): void;
  cancel(): void;
  complete(): void;
  isCanceled: boolean;
  id: string;
};

const MAX_ID = Number.MAX_SAFE_INTEGER - 2;
let nextUpdaterId = 0;
function getNextUpdaterId() {
  const r = nextUpdaterId.toString();
  nextUpdaterId = (nextUpdaterId + 1) % MAX_ID;
  return r;
}

/**
 * Creates a Controller responsible for managing asynchronous updates. By
 * default all and any dispatched updates cause any previous non resolved
 * updates to be canceled. This prevents occurrence of race conditions between
 * the dispatched updates.
 *
 * @param self Quark context
 * @internal
 */
export function createUpdateController<T>(
  self: QuarkContext<T, any>,
  setState: (action: T) => void,
): UpdateController<T> {
  let currentUpdate: AtomicUpdater<T> | undefined;

  if (self.configOptions.allowRaceConditions) {
    const unsafeUpdate = (): AtomicUpdater<T> => {
      const updater = (currentUpdate = {
        id: getNextUpdaterId(),
        isCanceled: false,
        cancel() {},
        complete() {
          if (currentUpdate === updater) {
            currentUpdate = undefined;
          }
        },
        update(action) {
          return setState(action);
        },
      });
      return updater;
    };

    return {
      atomicUpdate: unsafeUpdate,
      unsafeUpdate: unsafeUpdate,
      currentUpdate() {
        return currentUpdate;
      },
    };
  }

  const atomicUpdate = (): AtomicUpdater<T> => {
    let prevUpdate = currentUpdate;

    const updater: AtomicUpdater<T> = {
      id: getNextUpdaterId(),
      isCanceled: false,
      update(state) {
        prevUpdate?.cancel();
        prevUpdate = undefined;

        if (updater.isCanceled) return;
        return setState(state);
      },
      cancel() {
        prevUpdate?.cancel();
        prevUpdate = undefined;

        updater.isCanceled = true;
      },
      complete() {
        prevUpdate = undefined;
        if (currentUpdate === updater) {
          currentUpdate = undefined;
        }
        updater.update = () => {
          console.warn(
            new Error(
              "An update has been made after the action has completed. Make sure to perform state updates before the action returns.",
            ),
          );
        };
      },
    };

    currentUpdate = updater;

    return updater;
  };

  const unsafeUpdate = (): AtomicUpdater<T> => {
    const updater: AtomicUpdater<T> = {
      id: getNextUpdaterId(),
      isCanceled: false,
      update(state) {
        return setState(state);
      },
      cancel() {},
      complete() {
        updater.update = () => {};
      },
    };

    return updater;
  };

  return {
    atomicUpdate,
    unsafeUpdate,
    currentUpdate() {
      return currentUpdate;
    },
  };
}
