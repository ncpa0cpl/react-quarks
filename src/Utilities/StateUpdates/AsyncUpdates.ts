import { QuarkContext } from "../../Types/Quark";
import { createEventsDebouncer } from "./EventsDispatcher";
import { Immediate, Resolvable } from "./Immediate";
import { processStateUpdate } from "./ProcessStateUpdate";

/**
 * Controller responsible for managing asynchronous updates. By default all and
 * any dispatched updates cause any previous non resolved updates to be
 * canceled. This prevents occurrence of race conditions between the dispatched
 * updates.
 *
 * @internal
 */
export type UpdateController<T> = {
  atomicUpdate<R>(update: (updater: AtomicUpdate<T>) => R): R;
  unsafeUpdate<R>(update: (updater: AtomicUpdate<T>) => R): R;
  currentUpdate(): AtomicUpdate<T> | undefined;
};

export type AtomicUpdate<T> = {
  update(action: T): T | Promise<T | undefined> | undefined;
  cancel(): void;
  complete(): void;
  queue<T>(action: () => T): T | Promise<T | undefined> | undefined;
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
  setState: (update: AtomicUpdate<T>, action: T) => T | undefined,
): UpdateController<T> {
  let currentUpdate: AtomicUpdate<T> | undefined;

  const atomicUpdate = (update: (updater: AtomicUpdate<T>) => any) => {
    let prevUpdate = currentUpdate;

    const updater: AtomicUpdate<T> = {
      id: getNextUpdaterId(),
      isCanceled: false,
      update(state) {
        prevUpdate?.cancel();
        prevUpdate = undefined;

        if (updater.isCanceled) return;
        return setState(updater, state);
      },
      queue(action) {
        if (updater.isCanceled) return;
        return action();
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
          return undefined;
        };
      },
    };

    currentUpdate = updater;

    return update(updater);
  };

  const unsafeUpdate = (update: (updater: AtomicUpdate<T>) => any) => {
    const updater: AtomicUpdate<T> = {
      id: getNextUpdaterId(),
      isCanceled: false,
      update(state) {
        return setState(updater, state);
      },
      queue(action) {
        return action();
      },
      cancel() {},
      complete() {
        updater.update = () => {
          return undefined;
        };
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

function isResolvable(p: any): p is Resolvable<any> {
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
      if (isResolvable(r)) {
        r
          .finally(onEnd)
          // prevent unhandled excpetion warnings
          .catch(() => {});
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
              if (isResolvable(r)) {
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
  setState: (update: AtomicUpdate<T>, action: T) => T | undefined,
): UpdateController<T> {
  let currentUpdate: AtomicUpdate<T> | undefined;

  const updateQueue = actionQueue();

  const atomicUpdate = (update: (updater: AtomicUpdate<T>) => any) => {
    const id = getNextUpdaterId();

    return updateQueue.add(id, () => {
      const subQueue = actionQueue();

      const updater: AtomicUpdate<T> = {
        id,
        isCanceled: false,
        update(state) {
          return updater.queue(() => setState(updater, state));
        },
        queue(action) {
          if (updater.isCanceled) return;
          return subQueue.add(id, () => {
            if (updater.isCanceled) {
              return;
            }
            return action();
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
            return undefined;
          };
        },
      };

      currentUpdate = updater;

      const r = update(updater);
      return r;
    });
  };

  const unsafeUpdate = (update: (updater: AtomicUpdate<T>) => any) => {
    const updater: AtomicUpdate<T> = {
      id: getNextUpdaterId(),
      isCanceled: false,
      update(state) {
        return setState(updater, state);
      },
      queue(action) {
        return action();
      },
      cancel() {},
      complete() {
        updater.update = () => {
          return undefined;
        };
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
  setState: (update: AtomicUpdate<T>, action: T) => T | undefined,
): UpdateController<T> {
  let currentUpdate: AtomicUpdate<T> | undefined;

  const unsafeUpdate = (update: (updater: AtomicUpdate<T>) => any) => {
    const updater = (currentUpdate = {
      id: getNextUpdaterId(),
      isCanceled: false,
      cancel() {},
      complete() {
        if (currentUpdate === updater) {
          currentUpdate = undefined;
        }
      },
      update(action): T | undefined {
        return setState(updater, action);
      },
      queue(action) {
        return action();
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
  self: QuarkContext<T>,
  overrideSetter?: (update: AtomicUpdate<T>, action: T) => any,
) {
  const setState = overrideSetter ?? ((update: AtomicUpdate<T>, action: T) => {
    const previousState = self.value;
    self.value = action;

    const { debounceEvent } = createEventsDebouncer();
    return processStateUpdate({
      self,
      previousState,
      actionState: action,
      update,
      debounceEvent,
    });
  });

  const { mode } = self.configOptions;
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
