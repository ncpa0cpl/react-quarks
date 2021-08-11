type CancelablePromise<T = void> = {
  then<R = void>(onFulfilled: (v: T) => Promise<R> | void): Promise<R | void>;
  cancel(): void;
};

function CancelablePromise<T = unknown>(
  executor: (resolve: (value: T) => void, reject: (reason?: any) => void) => void
): CancelablePromise<T> {
  let isCanceled = false;
  const p = new Promise(executor);

  p.catch((e) => {
    console.error("Asynchronous state update was unsuccessful due to an error:", e);
  });

  return {
    then(onFulfilled) {
      return p.then(async (v) => {
        if (!isCanceled) return Promise.resolve(await onFulfilled(v));
        else return Promise.resolve();
      });
    },
    cancel() {
      isCanceled = true;
    },
  };
}

export type AsyncUpdateController<T> = {
  dispatchAsyncUpdate: (p: Promise<T>, stateUpdate: (state: T) => void) => void;
  preventLastAsyncUpdate: () => void;
};

export function asyncUpdatesController<T>(): AsyncUpdateController<T> {
  let currentAsyncUpdate: CancelablePromise<T> | undefined;

  const preventLastAsyncUpdate = () => {
    currentAsyncUpdate?.cancel();
  };

  const dispatchAsyncUpdate = (p: Promise<T>, stateUpdate: (state: T) => void) => {
    preventLastAsyncUpdate();

    currentAsyncUpdate = CancelablePromise<T>((resolve, reject) => {
      p.then(resolve);
      p.catch(reject);
    });

    currentAsyncUpdate.then(stateUpdate);
  };

  return {
    dispatchAsyncUpdate,
    preventLastAsyncUpdate,
  };
}
