export interface Resolvable<T> {
  finally(cb: () => void): Resolvable<T>;
  catch<T2>(cb: (e: unknown) => T2): Resolvable<T | T2>;

  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ): Resolvable<TResult1 | TResult2>;
}

type ImmediateType<T> = T extends Resolvable<infer U> ? U : T;

type MapImmediates<T extends Resolvable<any>[]> = T extends
  [infer First, ...infer Rest extends Resolvable<any>[]]
  ? [ImmediateType<First>, ...MapImmediates<Rest>]
  : [];

export class Immediate<T = void> implements Resolvable<T> {
  static all<const T extends Resolvable<any>[]>(
    ...resolvables: T
  ): Resolvable<MapImmediates<T>> {
    const promises: Promise<[idx: number, value: unknown]>[] = [];
    const results = [] as MapImmediates<T>;

    for (let i = 0; i < resolvables.length; i++) {
      const imm = resolvables[i];
      if (imm instanceof Immediate) {
        if (imm.error) {
          return Immediate.reject(imm.error);
        } else {
          results[i] = imm.value;
        }
      } else {
        const placeholder = Symbol("promise_placeholder");
        results[i] = placeholder;

        const promise = imm as Promise<unknown>;
        promises.push(promise.then((v) => [i, v]));
      }
    }

    if (promises.length > 0) {
      return Promise.all(promises).then(presults => {
        for (const [idx, value] of presults) {
          results[idx] = value;
        }
        return results;
      });
    }

    return Immediate.resolve(results);
  }

  static from<T>(
    cb: () => Promise<T> | Immediate<T> | Resolvable<T> | T,
  ): Resolvable<T> {
    try {
      const v = cb();
      if (v instanceof Promise || v instanceof Immediate) {
        return v;
      }
      return Immediate.resolve(v as T);
    } catch (e) {
      return Immediate.reject(e);
    }
  }

  static unpack<T>(v: T | Immediate<T>): T {
    if (v instanceof Immediate) {
      if (!v.success) {
        throw v.error;
      }
      return Immediate.unpack(v.value!);
    }
    return v;
  }
  static resolve(): Immediate<void>;
  static resolve<T = void>(v: T): Immediate<T>;
  static resolve(v?: any): Immediate<any> {
    if (v instanceof Immediate) {
      return v;
    }

    const r = Object.create(Immediate.prototype);
    r.value = v;
    r.success = true;
    return r;
  }

  static reject(e: any): Immediate<any> {
    const r = Object.create(Immediate.prototype);
    r.error = e;
    r.success = false;
    return r;
  }

  private value?: T;
  private error?: Error;
  private success?: boolean;

  public constructor(cb: () => Immediate<T> | T = () => void 0 as any) {
    try {
      this.value = Immediate.unpack(cb());
      this.success = true;
    } catch (e) {
      this.error = e as Error;
      this.success = false;
    }
  }
  public then<U = T, U2 = never>(
    onfulfilled?:
      | ((value: T) => U | Resolvable<U>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => U2 | Resolvable<U2>)
      | undefined
      | null,
  ): Resolvable<U | U2> {
    if (this.success) {
      return new Immediate<U>(() => {
        const r = onfulfilled?.(this.value!) ?? this.value;
        return r as any;
      });
    } else if (onrejected) {
      // @ts-expect-error
      return this.catch(onrejected);
    }
    return this as any as Immediate<U>;
  }

  public catch<U>(cb: (err: Error) => U): Immediate<T | U> {
    if (!this.success) {
      return new Immediate<U>(() => {
        return cb(this.error!);
      });
    }
    return this;
  }

  public finally<U>(cb: () => U): Immediate<T> {
    try {
      cb();
    } catch (e) {
      return Immediate.reject(e);
    }
    return this;
  }
}
