import type { QuarkContext } from "../../Types";
import { hasKey } from "../GeneralPurposeUtilities";

/**
 * An object wrapping a regular JavaScript Promise class instance that allows for
 * subscribing to it with a `.then()` method and cancel that subscription with a
 * `.cancel()` method.
 */
type CancelablePromise<T = void> = {
  /** Attach a function which should be called after Promise resolves. */
  then<R = void>(onFulfilled: (v: T) => Promise<R> | void): Promise<R | void>;
  /** Cancel all functions ever attached to this object via `.then()` method. */
  cancel(): void;
};

const PROMISE_CANCEL_STATUS_PROPERTY = Symbol(
  "__quark_internal_is_promise_canceled__"
);

/**
 * Check if the passed promise has been dispatched to the Quark as update and canceled.
 *
 * If the provided promise has not been ever dispatched as update `undefined` will be returned.
 *
 * @param promise A Promise class instance
 * @returns A boolean
 */
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

/**
 * Creates a CancelablePromise object which is an object wrapping a regular
 * JavaScript Promise class instance that allows for subscribing to it with a
 * `.then()` method and cancel that subscription with a `.cancel()` method.
 *
 * @param orgPromise A Promise class instance
 * @returns CancelablePromise object
 * @internal
 */
export function CancelablePromise<T = unknown>(
  orgPromise: Promise<T>
): CancelablePromise<T> {
  let isCanceled = false;

  assignCancelStatusToOriginalPromise(orgPromise, isCanceled);

  return {
    then(onFulfilled) {
      return orgPromise
        .then(async (v) => {
          if (!isCanceled) return Promise.resolve(await onFulfilled(v));
          else return Promise.resolve();
        })
        .catch((e) => {
          if (!isCanceled)
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

/**
 * Controller responsible for managing asynchronous updates. By default all and any
 * dispatched updates cause any previous non resolved updates to be canceled. This
 * prevents occurrence of race conditions between the dispatched updates.
 *
 * @internal
 */
export type AsyncUpdateController<T> = {
  /**
   * Dispatches an asynchronous update, after the provided Promise resolves an
   * updates via `stateUpdate` will be sent.
   *
   * Any previous pending updates will be canceled.
   */
  dispatchAsyncUpdate: (p: Promise<T>, stateUpdate: (state: T) => void) => void;
  /** Cancels the current pending asynchronous update if any. */
  preventLastAsyncUpdate: () => void;
};

/**
 * Creates a Controller responsible for managing asynchronous updates. By default all
 * and any dispatched updates cause any previous non resolved updates to be canceled.
 * This prevents occurrence of race conditions between the dispatched updates.
 *
 * @param self Quark context
 * @internal
 */
export function asyncUpdatesController<T>(
  self: QuarkContext<T, any, any>
): AsyncUpdateController<T> {
  let currentAsyncUpdate: CancelablePromise<T> | undefined;

  const preventLastAsyncUpdate = self.configOptions.allowRaceConditions
    ? () => {}
    : () => {
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
