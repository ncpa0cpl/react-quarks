import { InitiateActionFn } from "../../Types/Actions";
import {
  InitiateProcedureFn,
  ProcedureApi,
  ProcedureStateSetter,
} from "../../Types/Procedures";
import { QuarkContext, SetStateAction } from "../../Types/Quark";
import { CancelUpdate } from "../CancelUpdate";
import { applyMiddlewares } from "./ApplyMiddlewares";
import { AtomicUpdater, createUpdateController } from "./AsyncUpdates";
import { createEventsDebouncer as createEventDebouncer } from "./EventsDispatcher";
import { processStateUpdate } from "./ProcessStateUpdate";
import { resolveUpdateType } from "./ResolveUpdateType";
import { unpackStateSetter, unpackStateSetterSync } from "./UnpackStateSetter";

/**
 * Generates a function that allows for updating the state of the Quark.
 *
 * Updating the state with this function will trigger the Quark middlewares.
 *
 * @param self Quark context
 * @returns A method for updating the Quark state, this method can take as it's
 *   argument the new state value, a generator function or a Promise resolving
 *   to the new value.
 * @internal
 */
export function generateSetter<T, ET>(self: QuarkContext<T, ET>) {
  const { debounceEvent } = createEventDebouncer();
  const updateController = createUpdateController(self, (action) => {
    const previousState = self.value;
    self.value = action;

    return processStateUpdate({
      self,
      previousState,
      applyMiddlewaresAndUpdateState: set,
      debounceEvent,
    });
  });

  const setVia = (
    action: SetStateAction<T, ET>,
    updater: AtomicUpdater<T>,
  ): void | Promise<void> => {
    const type = resolveUpdateType(action);
    return applyMiddlewares(
      self,
      action,
      type,
      updater,
      (action2) =>
        unpackStateSetter(self, updater, action2).then((s) => {
          return updater.update(s);
        }),
    );
  };

  /**
   * A method for updating the Quark state, this method can take as it's
   * argument the new state value, a generator function or a Promise resolving
   * to the new value.
   */
  const set = (action: SetStateAction<T, ET>): void | Promise<void> => {
    const updater = updateController.atomicUpdate();
    return after(() => setVia(action, updater), () => updater.complete());
  };

  const bareboneSet = (action: SetStateAction<T, ET>) => {
    const updater = updateController.atomicUpdate();

    return unpackStateSetter(self, updater, action).then((newState) => {
      if (updater.isCanceled) return;
      self.value = newState;
      updater.complete();
    });
  };

  const unsafeSet = (action: T | ((current: T) => T)) => {
    const updater = updateController.unsafeUpdate();
    return applyMiddlewares(
      self,
      action,
      resolveUpdateType(action),
      updater,
      (action2) =>
        unpackStateSetterSync(self, updater, action2).then((s) => {
          updater.update(s);
          updater.complete();
        }),
    );
  };

  const initiateAction: InitiateActionFn<T, any> = (action) => {
    const updater = updateController.atomicUpdate();

    return after(() => {
      const pending: Promise<any>[] = [];

      const result = action({
        getState() {
          return self.value;
        },
        setState(action) {
          const r = setVia(action, updater);
          if (r instanceof Promise) {
            pending.push(r);
          }
          return r;
        },
        unsafeSet(state) {
          return unsafeSet(state);
        },
        dispatchNew(action) {
          return initiateAction(action) as any;
        },
        isCanceled() {
          return updater.isCanceled;
        },
      });

      if (pending.length > 0) {
        return Promise.all(pending).then(() => result);
      }

      return result;
    }, () => updater.complete());
  };

  const initiateProcedure: InitiateProcedureFn<T> = async (procedure) => {
    const updater = updateController.atomicUpdate();

    const procedureApi: ProcedureApi<T> = {
      getState() {
        return self.value;
      },
      unsafeSet(state) {
        return unsafeSet(state);
      },
      isCanceled() {
        return updater.isCanceled;
      },
    };

    return applyMiddlewares(
      self,
      procedure,
      "async-generator",
      updater,
      async (p) => {
        try {
          const generator = p(procedureApi);
          let nextUp: IteratorResult<
            ProcedureStateSetter<T>,
            ProcedureStateSetter<T>
          >;
          do {
            if (updater.isCanceled) break;

            nextUp = await generator.next(self.value);
            const v = nextUp.value;

            const type = resolveUpdateType(v);
            applyMiddlewares(
              self,
              v,
              type,
              updater,
              (action) =>
                unpackStateSetterSync(self, updater, action).then(
                  (newState) => {
                    updater.update(newState);
                  },
                ),
            );
          } while (!nextUp.done);
        } catch (err) {
          if (CancelUpdate.isCancel(err)) {
            return;
          }
          throw err;
        } finally {
          updater.complete();
        }
      },
    );
  };

  return {
    set,
    unsafeSet,
    bareboneSet,
    initiateAction,
    initiateProcedure,
    updateController: updateController,
  };
}

function after<T>(fn: () => T, doAfter: () => void): T {
  let isAsync = false;

  try {
    const result = fn();
    if (result instanceof Promise) {
      isAsync = true;
      result.finally(doAfter) as any;
    }
    return result;
  } finally {
    if (!isAsync) doAfter();
  }
}
