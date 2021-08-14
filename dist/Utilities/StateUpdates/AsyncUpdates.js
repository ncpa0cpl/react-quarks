import { hasKey } from "../GeneralPurposeUtilities";
const PROMISE_CANCEL_STATUS_PROPERTY = "__quark_internal_is_promise_canceled__";
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
function CancelablePromise(orgPromise) {
    const executor = (resolve, reject) => {
        orgPromise.then(resolve).catch(reject);
    };
    let isCanceled = false;
    const p = new Promise(executor);
    assignCancelStatusToOriginalPromise(orgPromise, isCanceled);
    return {
        then(onFulfilled) {
            return p
                .then(async (v) => {
                if (!isCanceled)
                    return Promise.resolve(await onFulfilled(v));
                else
                    return Promise.resolve();
            })
                .catch((e) => {
                console.error("Asynchronous state update was unsuccessful due to an error:", e);
            });
        },
        cancel() {
            isCanceled = true;
            assignCancelStatusToOriginalPromise(orgPromise, isCanceled);
        },
    };
}
export function asyncUpdatesController(self) {
    let currentAsyncUpdate;
    const preventLastAsyncUpdate = () => {
        if (self.configOptions.allowRaceConditions)
            return;
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
