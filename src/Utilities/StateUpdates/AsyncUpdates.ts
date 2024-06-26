import type { QuarkContext } from "../../Types";

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
  currentUpdate(): AtomicUpdater<T> | undefined;
};

export type AtomicUpdater<T> = {
  update(action: T): void;
  cancel(): void;
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
  setState: (action: T) => void
): UpdateController<T> {
  let currentUpdate: AtomicUpdater<T> | undefined;

  if (self.configOptions.allowRaceConditions) {
    return {
      atomicUpdate() {
        return (currentUpdate = {
          id: getNextUpdaterId(),
          isCanceled: false,
          cancel() {},
          update(action) {
            return setState(action);
          },
        });
      },
      currentUpdate() {
        return currentUpdate;
      },
    };
  }

  const atomicUpdate = (): AtomicUpdater<T> => {
    const updater: AtomicUpdater<T> = {
      id: getNextUpdaterId(),
      isCanceled: false,
      update(state) {
        if (updater.isCanceled) return;
        return setState(state);
      },
      cancel() {
        updater.isCanceled = true;
      },
    };

    currentUpdate?.cancel();
    currentUpdate = updater;

    return updater;
  };

  return {
    atomicUpdate,
    currentUpdate() {
      return currentUpdate;
    },
  };
}
