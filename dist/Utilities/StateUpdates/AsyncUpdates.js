import { hasKey } from "../GeneralPurposeUtilities";
const PROMISE_CANCEL_STATUS_PROPERTY = Symbol("__quark_internal_is_promise_canceled__");
/**
 * Check if the passed promise has been dispatched to the Quark as update and canceled.
 *
 * If the provided promise has not been ever dispatched as update `undefined` will be returned.
 *
 * @param promise A Promise class instance
 * @returns A boolean
 */
export function extractIsPromiseCanceled(promise) {
    if (typeof promise === "object" &&
        promise !== null &&
        hasKey(promise, PROMISE_CANCEL_STATUS_PROPERTY)) {
        return promise[PROMISE_CANCEL_STATUS_PROPERTY];
    }
}
function assignCancelStatusToOriginalPromise(promise, canceled) {
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
export function CancelablePromise(orgPromise) {
    let isCanceled = false;
    assignCancelStatusToOriginalPromise(orgPromise, isCanceled);
    return {
        then(onFulfilled) {
            return orgPromise
                .then(async (v) => {
                if (!isCanceled)
                    return Promise.resolve(await onFulfilled(v));
                else
                    return Promise.resolve();
            })
                .catch((e) => {
                if (!isCanceled)
                    console.error("Asynchronous state update was unsuccessful due to an error:", e);
            });
        },
        cancel() {
            isCanceled = true;
            assignCancelStatusToOriginalPromise(orgPromise, isCanceled);
        },
    };
}
/**
 * Creates a Controller responsible for managing asynchronous updates. By default all
 * and any dispatched updates cause any previous non resolved updates to be canceled.
 * This prevents occurrence of race conditions between the dispatched updates.
 *
 * @param self Quark context
 * @internal
 */
export function asyncUpdatesController(self) {
    let currentAsyncUpdate;
    const preventLastAsyncUpdate = self.configOptions.allowRaceConditions
        ? () => { }
        : () => {
            currentAsyncUpdate?.cancel();
            currentAsyncUpdate = undefined;
        };
    const dispatchAsyncUpdate = (p, stateUpdate) => {
        preventLastAsyncUpdate();
        currentAsyncUpdate = CancelablePromise(p);
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
