import { Immediate } from "./Immediate";

/**
 * Controller responsible for managing asynchronous updates. By default all and
 * any dispatched updates cause any previous non resolved updates to be
 * canceled. This prevents occurrence of race conditions between the dispatched
 * updates.
 *
 * @internal
 */
export type UpdateController<T> = {
  atomicUpdate<R>(update: (updater: AtomicUpdater<T>) => R): R;
  unsafeUpdate<R>(update: (updater: AtomicUpdater<T>) => R): R;
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
export function createCancelUpdateController<T>(
  setState: (action: T) => void,
): UpdateController<T> {
  let currentUpdate: AtomicUpdater<T> | undefined;

  const atomicUpdate = (update: (updater: AtomicUpdater<T>) => any) => {
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

    return update(updater);
  };

  const unsafeUpdate = (update: (updater: AtomicUpdater<T>) => any) => {
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

    return update(updater);
  };

  return {
    atomicUpdate,
    unsafeUpdate,
    currentUpdate() {
      return currentUpdate;
    },
  };
}

function isPromiseLike(p: any): p is PromiseLike<any> {
  return p != null
    && (p instanceof Promise || p instanceof Immediate);
}

function actionQueue() {
  let queue: Array<{ id: string; run: () => Promise<unknown> | unknown }> = [];
  let isProcessing = false;

  const onEnd = () => {
    if (queue.length === 0) {
      isProcessing = false;
      return;
    }

    const next = queue.shift();
    if (next) {
      processNext(next.run);
    } else {
      isProcessing = false;
    }
  };

  const processNext = <R>(next: () => Promise<R> | R) => {
    isProcessing = true;

    try {
      const r = next();
      if (isPromiseLike(r)) {
        r.finally(onEnd);
      } else {
        onEnd();
      }
      return r;
    } catch (err) {
      onEnd();
      throw err;
    }
  };

  const queueAdd = <R>(id: string, fn: () => Promise<R> | R) => {
    if (isProcessing || queue.length > 0) {
      return new Promise<R>((res, rej) => {
        queue.push({
          id,
          run: () => {
            try {
              const r = fn();
              if (isPromiseLike(r)) {
                r.then(res, rej);
              } else {
                res(r);
              }
              return r;
            } catch (err) {
              rej(err);
            }
          },
        });
      });
    }
    return processNext(fn);
  };

  return {
    add: queueAdd,
  };
}

/**
 * Creates a Controller responsible for managing asynchronous updates. By
 * default all and any dispatched updates will be queued and execcuted in
 * the same order as they are created. This prevents occurrence of race
 * conditions between the dispatched updates.
 *
 * @param self Quark context
 * @internal
 */
export function createQueuedUpdateController<T>(
  setState: (action: T) => void,
): UpdateController<T> {
  let currentUpdate: AtomicUpdater<T> | undefined;

  const updateQueue = actionQueue();

  const atomicUpdate = (update: (updater: AtomicUpdater<T>) => any) => {
    const id = getNextUpdaterId();

    return updateQueue.add(id, () => {
      const subQueue = actionQueue();

      const updater: AtomicUpdater<T> = {
        id,
        isCanceled: false,
        update(state) {
          if (updater.isCanceled) {
            return;
          }

          return subQueue.add(id, () => {
            if (updater.isCanceled) {
              return;
            }
            return setState(state);
          });
        },
        cancel() {
          updater.isCanceled = true;
        },
        complete() {
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

      const r = update(updater);
      return r;
    });
  };

  const unsafeUpdate = (update: (updater: AtomicUpdater<T>) => any) => {
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

    return update(updater);
  };

  return {
    atomicUpdate,
    unsafeUpdate,
    currentUpdate() {
      return currentUpdate;
    },
  };
}

/**
 * Creates a Controller responsible for managing asynchronous updates. By
 * default all and any dispatched updates will be queued and execcuted in
 * the same order as they are created. This prevents occurrence of race
 * conditions between the dispatched updates.
 *
 * @param self Quark context
 * @internal
 */
export function createUnsafeUpdateController<T>(
  setState: (action: T) => void,
): UpdateController<T> {
  let currentUpdate: AtomicUpdater<T> | undefined;

  const unsafeUpdate = (update: (updater: AtomicUpdater<T>) => any) => {
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
    return update(updater);
  };

  return {
    atomicUpdate: unsafeUpdate,
    unsafeUpdate: unsafeUpdate,
    currentUpdate() {
      return currentUpdate;
    },
  };
}

export function createUpdateController<T>(
  mode: "queue" | "cancel" | "none",
  setState: (action: T) => void,
) {
  switch (mode) {
    case "cancel":
      return createCancelUpdateController(setState);
    case "queue":
      return createQueuedUpdateController(setState);
    case "none":
      return createUnsafeUpdateController(setState);
  }
  throw new Error("invalid Quark mode: " + mode);
}
