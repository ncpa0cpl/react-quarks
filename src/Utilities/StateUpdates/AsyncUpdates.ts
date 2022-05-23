import type { QuarkContext, SetStateAction } from "../../Types";
import { CancelUpdate } from "../CancelUpdate";
import { hasKey } from "../GeneralPurposeUtilities";
import { propagateError } from "../PropagateError";

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
export function CancelablePromise<T extends SetStateAction<any, never>>(
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
          if (CancelUpdate.isCancel(e)) {
            assignCancelStatusToOriginalPromise(orgPromise, true);
            return;
          }

          if (!isCanceled) {
            const err = propagateError(
              e,
              "Asynchronous state update was unsuccessful due to an error."
            );

            console.error(err);
          }

          throw e;
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
export type AsyncUpdateController<T, ET> = {
  /**
   * Dispatches an asynchronous update, after the provided Promise resolves an
   * updates via `stateUpdate` will be sent.
   *
   * Any previous pending updates will be canceled.
   */
  dispatchAsyncUpdate: (
    p: Promise<SetStateAction<T, ET>>,
    stateUpdate: (state: SetStateAction<T, ET>) => void
  ) => void;
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
export function asyncUpdatesController<T, ET>(
  self: QuarkContext<T, any>
): AsyncUpdateController<T, ET> {
  let currentAsyncUpdate: CancelablePromise<unknown> | undefined;

  const preventLastAsyncUpdate: AsyncUpdateController<
    T,
    ET
  >["preventLastAsyncUpdate"] = self.configOptions.allowRaceConditions
    ? () => {}
    : () => {
        currentAsyncUpdate?.cancel();
        currentAsyncUpdate = undefined;
      };

  const dispatchAsyncUpdate: AsyncUpdateController<T, ET>["dispatchAsyncUpdate"] = (
    p,
    stateUpdate
  ) => {
    preventLastAsyncUpdate();

    const cp = CancelablePromise(p);

    currentAsyncUpdate = cp;

    return cp.then((v) => {
      currentAsyncUpdate = undefined;
      stateUpdate(v);
    });
  };

  return {
    dispatchAsyncUpdate,
    preventLastAsyncUpdate,
  };
}
