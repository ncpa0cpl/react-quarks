type Awaited<T> = T extends { then(onfulfilled: infer F, ...args: any[]): any }
  ? F extends ((value: infer V, ...args: any[]) => any) ? Awaited<V>
  : never
  : T;

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

export class Immediate<T = void> implements Resolvable<T> {
  static all<const T>(
    resolvables: Resolvable<T>[],
  ): Resolvable<T[]> {
    const promises: Promise<any>[] = [];
    const results = [] as Array<T>;

    for (let i = 0; i < resolvables.length; i++) {
      const imm = resolvables[i];
      if (imm instanceof Immediate) {
        if ((imm as Immediate).error) {
          return Immediate.reject((imm as Immediate).error);
        } else {
          results[i] = (imm as Immediate<T>).value!;
        }
      } else {
        promises.push((imm as Promise<any>).then(result => {
          results[i] = result;
        }));
      }
    }

    if (promises.length > 0) {
      return Promise.all(promises).then(() => results);
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

  static unpackTry<T>(v: T | Resolvable<T>): T | Promise<T> {
    if (v instanceof Promise) {
      return v;
    }

    if (v instanceof Immediate) {
      return Immediate.unpack(v as Immediate<T>);
    }

    return v as T;
  }

  static catch<T, T2>(
    fn: () => T | Resolvable<T>,
    onErr: (err: unknown) => T2,
  ): T | T2 | Resolvable<T | T2> {
    try {
      const v = fn();
      if (v instanceof Promise || v instanceof Immediate) {
        return v.catch(onErr);
      }
      return v;
    } catch (err) {
      return onErr(err);
    }
  }

  static finally<T>(
    fn: () => T | Resolvable<T>,
    onFinally: () => void,
  ): T | Resolvable<T> {
    let isAsync = false;
    try {
      const v = fn();
      if (v instanceof Promise || v instanceof Immediate) {
        isAsync = true;
        return v.finally(onFinally);
      }
      return v;
    } finally {
      if (!isAsync) {
        onFinally();
      }
    }
  }

  static catchFinally<T, T2>(
    fn: () => T | Resolvable<T>,
    onErr: (err: unknown) => T2,
    onFinally: () => void,
  ): T | T2 | Resolvable<T | T2> {
    let isAsync = false;
    try {
      const v = fn();
      if (v instanceof Promise || v instanceof Immediate) {
        isAsync = true;
        return v.catch(onErr).finally(onFinally);
      }
      return v;
    } catch (err) {
      return onErr(err);
    } finally {
      if (!isAsync) {
        onFinally();
      }
    }
  }

  static resolve(): Resolvable<void>;
  static resolve<R = void>(
    v: Promise<R> | Immediate<R> | Resolvable<R> | R,
  ): Resolvable<Awaited<R>>;
  static resolve(v?: any): Resolvable<any> {
    if (v instanceof Immediate || v instanceof Promise) {
      return v;
    }

    const r = Object.create(Immediate.prototype);
    r.value = v;
    r.success = true;
    return r;
  }

  static reject(e: any): Immediate<any> {
    if (e instanceof Immediate && e.error != null) {
      return e;
    }

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

  public then<TResult1 = T, TResult2 = never>(
    onfulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ): Resolvable<TResult1 | TResult2> {
    if (this.success) {
      return new Immediate<TResult1 | TResult2>(() => {
        const r = onfulfilled?.(this.value!) ?? this.value;
        return r as any;
      });
    } else if (onrejected) {
      // @ts-expect-error
      return this.catch(onrejected);
    }
    return this as any as Immediate<TResult1 | TResult2>;
  }

  public catch<T2>(cb: (e: unknown) => T2): Resolvable<T | T2> {
    if (!this.success) {
      return new Immediate<T2>(() => {
        return cb(this.error!);
      });
    }
    return this;
  }

  public finally(cb: () => void): Resolvable<T> {
    try {
      cb();
    } catch (e) {
      return Immediate.reject(e);
    }
    return this;
  }
}
