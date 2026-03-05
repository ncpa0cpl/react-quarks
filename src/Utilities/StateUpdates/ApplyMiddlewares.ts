import { QAction } from "../../Types/Actions";
import {
  QuarkContext,
  QuarkUpdateType,
  SetStateAction,
} from "../../Types/Quark";
import { AtomicUpdater } from "./AsyncUpdates";
import { Immediate } from "./Immediate";

class Semaphore<T> {
  wait;
  resolve!: (value: T | PromiseLike<T>) => void;
  reject!: (err?: any) => void;

  constructor() {
    this.wait = new Promise<T>((res, rej) => {
      this.resolve = res;
      this.reject = rej;
    });
  }
}

/**
 * Extract the list of middlewares from the Quark context and process the
 * `value` through each middleware in the list (unless one of the middlewares
 * stops the propagation).
 *
 * After processing through all middlewares or when propagation is stopped call
 * the `setterFn` with the final value.
 *
 * @param self Context of the Quark in question
 * @param value Value to be processed through middlewares
 * @param type Update type (one of: ['sync', 'async', 'async-generator'])
 * @param setterFn Function that updates the state of the Quark
 * @internal
 */
export function applyMiddlewares<
  T,
  A extends SetStateAction<T> | QAction<T>,
  R,
>(
  self: QuarkContext<T>,
  value: A,
  type: QuarkUpdateType,
  updater: AtomicUpdater<T>,
  setterFn: (v: A) => PromiseLike<R>,
) {
  const applyMiddlewareOfIndex = (
    index: number,
    v: A,
  ): PromiseLike<R> => {
    const nextMiddleware = self.middlewares[index];
    if (nextMiddleware) {
      let isResumed = false;
      let resumedValue: undefined | { value: PromiseLike<any> };
      let semaphore: undefined | Semaphore<SetStateAction<any>>;

      try {
        const action = nextMiddleware({
          getState: () => self.value,
          action: v as any,
          resume: (rv: any) => {
            if (isResumed) {
              throw new Error(
                "middleware error: action cannot be resumed more than once",
              );
            }
            isResumed = true;

            const result = applyMiddlewareOfIndex(index + 1, rv as A);

            // if the setterFn returns an Immediate we are still sync,
            // so do not use semaphore as it would result in a Promise being returned
            if (result instanceof Immediate) {
              resumedValue = { value: result };
              return Immediate.unpack(result);
            }

            // not an Immediate, so must be a Promise - we are async
            semaphore = new Semaphore<SetStateAction<any>>();
            return result.then(
              result => {
                semaphore!.resolve(result);
              },
              error => {
                semaphore!.reject(error);
              },
            );
          },
          set: setterFn as any,
          updateType: type as any,
          updater,
        });

        if (semaphore != null) {
          return semaphore.wait;
        }

        if (resumedValue) {
          return resumedValue.value;
        }

        return applyMiddlewareOfIndex(index + 1, action as A);
      } catch (err) {
        return Immediate.reject(err);
      }
    } else {
      return setterFn(v);
    }
  };

  return applyMiddlewareOfIndex(0, value);
}
