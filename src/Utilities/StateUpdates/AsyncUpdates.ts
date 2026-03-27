import { QuarkContext } from "../../Types/Quark";
import { Semaphore } from "../Utils";
import { createEventsDebouncer } from "./EventsDispatcher";
import { Immediate, Resolvable } from "./Immediate";
import { processStateUpdate } from "./ProcessStateUpdate";

type UpdateControllerBase<T> = {
  atomicUpdate<R>(update: (updater: AtomicUpdate<T>) => R): Resolvable<R>;
  unsafeUpdate<R>(update: (updater: AtomicUpdate<T>) => R): Resolvable<R>;
  currentUpdate(): AtomicUpdate<T> | undefined;
};

/**
 * Controller responsible for managing asynchronous updates. By default all and
 * any dispatched updates cause any previous non resolved updates to be
 * canceled. This prevents occurrence of race conditions between the dispatched
 * updates.
 *
 * @internal
 */
export type UpdateController<T> = UpdateControllerBase<T> & {
  createAtomicUpdateObject(): Resolvable<AtomicUpdate<T>>;
  with(
    childControllers: Record<string, UpdateController<any>>,
  ): UpdateControllerBase<T>;
};

export type AtomicUpdate<T> = {
  update(action: T): Resolvable<T | undefined>;
  cancel(): void;
  complete(): void;
  queue<T>(action: () => T): Resolvable<T | undefined>;
  isCanceled: boolean;
  id: string;
  children?: Record<string, AtomicUpdate<any>>;
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

  const createUpdate = () => {
    let prevUpdate = currentUpdate;

    const updater: AtomicUpdate<T> = {
      id: getNextUpdaterId(),
      isCanceled: false,
      update(state) {
        prevUpdate?.cancel();
        prevUpdate = undefined;

        if (updater.isCanceled) return Immediate.resolve(undefined);
        return Immediate.resolve(setState(updater, state));
      },
      queue(action) {
        if (updater.isCanceled) return Immediate.resolve(undefined);
        return Immediate.resolve(action());
      },
      cancel() {
        prevUpdate?.cancel();
        prevUpdate = undefined;

        updater.isCanceled = true;

        for (const k in updater.children) {
          updater.children[k].cancel();
        }
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
          return Immediate.resolve(undefined);
        };
        for (const k in updater.children) {
          updater.children[k].complete();
        }
      },
    };

    currentUpdate = updater;

    return updater;
  };

  const createUnsafeUpdate = () => {
    const updater: AtomicUpdate<T> = {
      id: getNextUpdaterId(),
      isCanceled: false,
      update(state) {
        return Immediate.resolve(setState(updater, state));
      },
      queue(action) {
        return Immediate.resolve(action());
      },
      cancel() {
        for (const k in updater.children) {
          updater.children[k].cancel();
        }
      },
      complete() {
        updater.update = () => {
          return Immediate.resolve(undefined);
        };
        for (const k in updater.children) {
          updater.children[k].complete();
        }
      },
    };
    return updater;
  };

  return {
    atomicUpdate(update: (updater: AtomicUpdate<T>) => any) {
      return update(createUpdate());
    },
    unsafeUpdate(update: (updater: AtomicUpdate<T>) => any) {
      return update(createUnsafeUpdate());
    },
    currentUpdate() {
      return currentUpdate;
    },
    createAtomicUpdateObject() {
      return Immediate.resolve(createUpdate());
    },
    with(children) {
      return {
        atomicUpdate(runUpdate) {
          const updater = createUpdate();
          const c = requestChildUpdaters(children);

          return c.then((cu) => {
            updater.children = cu;
            const r = runUpdate(updater);
            return r;
          });
        },
        unsafeUpdate(runUpdate) {
          const updater = createUnsafeUpdate();
          const c = requestChildUpdaters(children);

          return c.then((cu) => {
            updater.children = cu;
            const r = runUpdate(updater);
            return r;
          });
        },
        currentUpdate() {
          return currentUpdate;
        },
      };
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

  const processNext = <R>(next: () => Resolvable<R> | R): Resolvable<R> => {
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
      return Immediate.resolve(r);
    } catch (err) {
      onEnd();
      throw err;
    }
  };

  const queueAdd = <R>(
    id: string,
    fn: () => Resolvable<R> | R,
  ): Resolvable<R> => {
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

  const addControlled = (id: string) => {
    let end: Semaphore | undefined;

    return {
      lock(): Resolvable<void> {
        if (isProcessing || queue.length > 0) {
          const start = new Semaphore();
          end = new Semaphore();

          queue.push({
            id,
            run() {
              start.resolve();
              return end!.promise;
            },
          });

          return start.promise;
        }

        isProcessing = true;
        return Immediate.resolve();
      },
      unlock() {
        onEnd();
      },
    };
  };

  return {
    add: queueAdd,
    addControlled,
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

  const createUpdate = (id: string, onComplete?: () => void) => {
    const subQueue = actionQueue();

    const updater: AtomicUpdate<T> = {
      id,
      isCanceled: false,
      update(state) {
        return updater.queue(() => setState(updater, state));
      },
      queue(action) {
        if (updater.isCanceled) return Immediate.resolve(undefined);
        return subQueue.add(id, () => {
          if (updater.isCanceled) {
            return;
          }
          return action();
        });
      },
      cancel() {
        updater.isCanceled = true;
        for (const k in updater.children) {
          updater.children[k].cancel();
        }
      },
      complete() {
        updater.update = () => {
          console.warn(
            new Error(
              "An update has been made after the action has completed. Make sure to perform state updates before the action returns.",
            ),
          );
          return Immediate.resolve(undefined);
        };
        for (const k in updater.children) {
          updater.children[k].complete();
        }
        onComplete?.();
      },
    };

    currentUpdate = updater;
    return updater;
  };

  const atomicUpdate = (update: (updater: AtomicUpdate<T>) => any) => {
    const id = getNextUpdaterId();

    return updateQueue.add(id, () => {
      const updater = createUpdate(id);
      const r = update(updater);
      return r;
    });
  };

  const createUnsafeUpdate = () => {
    const updater: AtomicUpdate<T> = {
      id: getNextUpdaterId(),
      isCanceled: false,
      update(state) {
        return Immediate.resolve(setState(updater, state));
      },
      queue(action) {
        return Immediate.resolve(action());
      },
      cancel() {
        for (const k in updater.children) {
          updater.children[k].cancel();
        }
      },
      complete() {
        updater.update = () => {
          return Immediate.resolve(undefined);
        };
        for (const k in updater.children) {
          updater.children[k].complete();
        }
      },
    };
    return updater;
  };

  const unsafeUpdate = (update: (updater: AtomicUpdate<T>) => any) => {
    return update(createUnsafeUpdate());
  };

  return {
    atomicUpdate,
    unsafeUpdate,
    currentUpdate() {
      return currentUpdate;
    },
    createAtomicUpdateObject() {
      const id = getNextUpdaterId();
      const q = updateQueue.addControlled(id);
      return q.lock().then(() => {
        const u = createUpdate(id, () => q.unlock());
        return u;
      });
    },
    with(children) {
      return {
        atomicUpdate(runUpdate) {
          const id = getNextUpdaterId();
          const c = requestChildUpdaters(children);

          return updateQueue.add(id, () => {
            const updater = createUpdate(id);
            return c.then((cu) => {
              updater.children = cu;
              const r = runUpdate(updater);
              return r;
            });
          });
        },
        unsafeUpdate(runUpdate) {
          const id = getNextUpdaterId();
          const c = requestChildUpdaters(children);

          return updateQueue.add(id, () => {
            const updater = createUnsafeUpdate();
            return c.then((cu) => {
              updater.children = cu;
              const r = runUpdate(updater);
              return r;
            });
          });
        },
        currentUpdate() {
          return currentUpdate;
        },
      };
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

  const createUpdateFactory =
    (subControllers?: Record<string, UpdateController<any>>) => () => {
      const updater: AtomicUpdate<T> = (currentUpdate = {
        id: getNextUpdaterId(),
        isCanceled: false,
        cancel() {
          for (const k in updater.children) {
            updater.children[k].cancel();
          }
        },
        complete() {
          if (currentUpdate === updater) {
            currentUpdate = undefined;
          }
          for (const k in updater.children) {
            updater.children[k].complete();
          }
        },
        update(action) {
          return Immediate.resolve(setState(updater, action));
        },
        queue(action) {
          return Immediate.resolve(action());
        },
      });

      if (subControllers) {
        const childUpdates = Object.entries(
          subControllers ?? {},
        ).map(([k, c]) =>
          c.createAtomicUpdateObject().then((up) => [k, up] as const)
        );

        return Immediate.all(childUpdates).then(c => {
          updater.children = Object.fromEntries(c);
          return updater;
        });
      }

      return Immediate.resolve(updater);
    };

  const createUpdate = createUpdateFactory();

  const set = (update: (updater: AtomicUpdate<T>) => any) => {
    return createUpdate().then((u) => update(u));
  };

  return {
    atomicUpdate: set,
    unsafeUpdate: set,
    createAtomicUpdateObject: createUpdate,
    currentUpdate() {
      return currentUpdate;
    },
    with(subControllers) {
      const createUpdate = createUpdateFactory(subControllers);

      const set = (update: (updater: AtomicUpdate<T>) => any) => {
        return createUpdate().then((u) => update(u));
      };

      return {
        atomicUpdate: set,
        unsafeUpdate: set,
        currentUpdate() {
          return currentUpdate;
        },
      };
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

function requestChildUpdaters(
  subControllers: Record<string, UpdateController<any>>,
) {
  const childUpdates = Object.entries(
    subControllers ?? {},
  ).map(([k, c]) =>
    c.createAtomicUpdateObject().then((up) => [k, up] as const)
  );

  return Immediate.all(childUpdates).then(c => {
    return Object.fromEntries(c);
  });
}
