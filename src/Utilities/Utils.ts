import { QAction } from "../Types/Actions";
import {
  BaseCollection,
  CollectionAction,
  CollectionProcedureAction,
} from "../Types/Collections";
import { ProcedureAction } from "../Types/Procedures";

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export class Semaphore<R = void> {
  promise;
  resolve!: (value: R | PromiseLike<R>) => void;
  reject!: (reason?: any) => void;

  constructor() {
    this.promise = new Promise<R>((res, rej) => {
      this.resolve = res;
      this.reject = rej;
    });
  }
}

export function isGeneratorFunction<T>(
  v: QAction<T>,
): v is ProcedureAction<T>;
export function isGeneratorFunction<Q extends BaseCollection<any>>(
  v: CollectionAction<Q>,
): v is CollectionProcedureAction<Q>;
export function isGeneratorFunction(
  v: Function,
) {
  return Object.prototype.toString.call(v)
    === "[object AsyncGeneratorFunction]";
}

export class NoopUpdate {}
