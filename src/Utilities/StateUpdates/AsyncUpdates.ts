import type { QuarkContext } from "../../Types";
import { hasKey } from "../GeneralPurposeUtilities";

type CancelablePromise<T = void> = {
  then<R = void>(onFulfilled: (v: T) => Promise<R> | void): Promise<R | void>;
  cancel(): void;
};

const PROMISE_CANCEL_STATUS_PROPERTY = "__quark_internal_is_promise_canceled__";

export function extractIsPromiseCanceled(promise: unknown) {
  if (
    typeof promise === "object" &&
    promise !== null &&
    hasKey(promise, PROMISE_CANCEL_STATUS_PROPERTY)
  ) {
    return promise[PROMISE_CANCEL_STATUS_PROPERTY] as boolean;
  }
}

function assignCancelStatusToOriginalPromise(
  promise: Promise<any>,
  canceled: boolean
) {
  Object.assign(promise, { [PROMISE_CANCEL_STATUS_PROPERTY]: canceled });
}

function CancelablePromise<T = unknown>(
  orgPromise: Promise<T>
): CancelablePromise<T> {
  const executor: (
    resolve: (value: T) => void,
    reject: (reason?: any) => void
  ) => void = (resolve, reject) => {
    orgPromise.then(resolve).catch(reject);
  };

  let isCanceled = false;
  const p = new Promise(executor);

  assignCancelStatusToOriginalPromise(orgPromise, isCanceled);

  return {
    then(onFulfilled) {
      return p
        .then(async (v) => {
          if (!isCanceled) return Promise.resolve(await onFulfilled(v));
          else return Promise.resolve();
        })
        .catch((e) => {
          console.error(
            "Asynchronous state update was unsuccessful due to an error:",
            e
          );
        });
    },
    cancel() {
      isCanceled = true;
      assignCancelStatusToOriginalPromise(orgPromise, isCanceled);
    },
  };
}

export type AsyncUpdateController<T> = {
  dispatchAsyncUpdate: (p: Promise<T>, stateUpdate: (state: T) => void) => void;
  preventLastAsyncUpdate: () => void;
};

export function asyncUpdatesController<T>(
  self: QuarkContext<T, any, any>
): AsyncUpdateController<T> {
  let currentAsyncUpdate: CancelablePromise<T> | undefined;

  const preventLastAsyncUpdate = () => {
    if (self.configOptions.allowRaceConditions) return;
    currentAsyncUpdate?.cancel();
    currentAsyncUpdate = undefined;
  };

  const dispatchAsyncUpdate = (p: Promise<T>, stateUpdate: (state: T) => void) => {
    preventLastAsyncUpdate();

    currentAsyncUpdate = CancelablePromise<T>(p);

    currentAsyncUpdate.then((v) => {
      currentAsyncUpdate = undefined;
      stateUpdate(v);
    });
  };

  return {
    dispatchAsyncUpdate,
    preventLastAsyncUpdate,
  };
}
