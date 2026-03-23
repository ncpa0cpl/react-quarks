import { isDispatchFn } from "../IsGenerator";
import { DispatchAction } from "./ApplyMiddlewares";
import { Immediate, Resolvable } from "./Immediate";

/**
 * @internal
 */
export type Thenable<T> = {
  then<R>(cb: (v: T) => R): Thenable<R>;
};

/**
 * If the provided value is a Promise or a State Generator, resolve it and the
 * pass the received value to the middlewares and then "unpack" it again.
 *
 * If the provided value is of any other type, signal the async controller to
 * cancel ongoing updates and resolve the function passed to the `then()` method
 * with the value.
 *
 * @param self Quark context
 * @param updater Asynchronous updates controller
 * @param dispatch Value dispatched as an update to be unpacked
 * @param onUnpack callback invoked immediately after the action is resolved
 * @internal
 */
export function unpackAction<T>(
  dispatch: DispatchAction<T, any>,
  onUnpack: (action: T) => T | undefined | Promise<T | undefined>,
): Resolvable<T | undefined> {
  try {
    if (dispatch.action instanceof Promise) {
      return dispatch._middleware.applyPromise(
        dispatch,
        (d) => {
          return d.action.then(next => {
            dispatch.action = next;
            return unpackAction(dispatch, onUnpack);
          });
        },
      );
    }

    if (isDispatchFn<T>(dispatch.action)) {
      return dispatch._middleware.applyFunction(
        dispatch,
        (d) => {
          try {
            const s = d.action(dispatch._q.value);
            dispatch.action = s;
            return unpackAction(dispatch, onUnpack);
          } catch (err) {
            return Immediate.reject(err);
          }
        },
      );
    }

    return dispatch._middleware.applyValue(
      dispatch,
      () => {
        const result = onUnpack(dispatch.action as T);
        if (result instanceof Promise) return result;
        return Immediate.resolve(result as T);
      },
    );
  } catch (err) {
    return Immediate.reject(err);
  }
}

export function unpackActionSync<T>(
  dispatch: DispatchAction<T, any>,
  onUnpack: (action: T) => T | undefined | Promise<T | undefined>,
): Resolvable<T | undefined> {
  try {
    if (isDispatchFn<T>(dispatch.action)) {
      return dispatch._middleware.applyFunction(
        dispatch,
        (d) => {
          const s = d.action(dispatch._q.value);
          dispatch.action = s;
          return unpackAction(dispatch, onUnpack);
        },
      );
    }

    return dispatch._middleware.applyValue(
      dispatch,
      () => {
        const result = onUnpack(dispatch.action as T);
        if (result instanceof Promise) return result;
        return Immediate.resolve(result as T);
      },
    );
  } catch (err) {
    return Immediate.reject(err);
  }
}
