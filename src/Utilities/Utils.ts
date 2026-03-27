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
