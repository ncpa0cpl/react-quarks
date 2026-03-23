import { ProcedureAction, QuarkMiddleware } from "../..";
import { FunctionAction, QAction } from "../../Types/Actions";
import {
  DispatchAsync,
  DispatchFunc,
  QuarkContext,
  QuarkUpdateType,
  SetStateAction,
} from "../../Types/Quark";
import { AtomicUpdate } from "./AsyncUpdates";
import { Immediate, Resolvable } from "./Immediate";
import { resolveUpdateType } from "./ResolveUpdateType";
import { unpackAction } from "./UnpackAction";

export function setWithMiddlewares<T>(
  self: QuarkContext<T>,
  action: SetStateAction<T>,
  updater: AtomicUpdate<T>,
) {
  try {
    const type = resolveUpdateType(action);
    const dispatch = new DispatchAction<T, any>(
      self,
      updater,
      type,
      self.middleware,
      action,
    );

    return unpackAction(dispatch, (s) => {
      return updater.update(s);
    });
  } catch (err) {
    return Immediate.reject(err);
  }
}

export class DispatchAction<T, Action> {
  /** @internal */
  _metadata = new Map<string, Record<string, any>>();

  /** @internal */
  public _onNext!: (action: Action) => Resolvable<T | undefined>;

  constructor(
    /** @internal */
    public _q: QuarkContext<T>,
    /** @internal */
    public _update: AtomicUpdate<T>,
    /** @internal */
    public _origin: QuarkUpdateType,
    /** @internal */
    public _middleware: MdController<T>,
    public action: Action,
  ) {
  }

  meta<M extends Record<string, any> = Record<string, any>>(mdkey: string): M {
    let o = this._metadata.get(mdkey);
    if (o != null) return o as M;

    o = {};
    this._metadata.set(mdkey, o);
    return o as M;
  }

  get(): T {
    return this._q.value;
  }

  set(value: T) {
    this._update.update(value);
  }

  update(): AtomicUpdate<T> {
    return this._update;
  }

  next(action: Action) {
    return this._onNext(action);
  }

  skip() {
    return this.next(this.action);
  }

  origin(): QuarkUpdateType {
    return this._origin;
  }
}

export class MdController<T> {
  constructor(
    private _q: QuarkContext<T>,
    private mdValue: Array<QuarkMiddleware<T>>,
    private mdPromise: Array<QuarkMiddleware<T>>,
    private mdFunction: Array<QuarkMiddleware<T>>,
    private mdAction: Array<QuarkMiddleware<T>>,
    private mdProcedure: Array<QuarkMiddleware<T>>,
  ) {}

  applyValue(
    dispatch: DispatchAction<T, T>,
    finalize: (
      v: DispatchAction<T, T>,
    ) => Resolvable<T | undefined>,
  ) {
    if (this.mdValue.length === 0) {
      return finalize(dispatch);
    }

    let idx = 0;
    dispatch._onNext = (nextAction) => {
      dispatch.action = nextAction;
      const m = this.mdValue[idx++]!;
      if (m) {
        return m.onValue!(dispatch);
      }

      return finalize(dispatch);
    };

    const m = this.mdValue[idx++]!;
    return m.onValue!(dispatch);
  }

  applyFunction(
    dispatch: DispatchAction<T, DispatchFunc<T>>,
    finalize: (
      v: DispatchAction<T, DispatchFunc<T>>,
    ) => Resolvable<T | undefined>,
  ) {
    if (this.mdFunction.length === 0) {
      return finalize(dispatch);
    }

    let idx = 0;
    dispatch._onNext = (nextAction) => {
      dispatch.action = nextAction;
      const m = this.mdFunction[idx++]!;
      if (m) {
        return m.onFunction!(dispatch);
      }

      return finalize(dispatch);
    };

    const m = this.mdFunction[idx++]!;
    return m.onFunction!(dispatch);
  }

  applyPromise(
    dispatch: DispatchAction<T, DispatchAsync<T>>,
    finalize: (
      v: DispatchAction<T, DispatchAsync<T>>,
    ) => Resolvable<T | undefined>,
  ) {
    if (this.mdPromise.length === 0) {
      return finalize(dispatch);
    }

    let idx = 0;
    dispatch._onNext = (nextAction) => {
      dispatch.action = nextAction;
      const m = this.mdPromise[idx++]!;
      if (m) {
        return m.onPromise!(dispatch);
      }

      return finalize(dispatch);
    };

    const m = this.mdPromise[idx++]!;
    return m.onPromise!(dispatch);
  }

  applyAction(
    dispatch: DispatchAction<T, FunctionAction<T>>,
    finalize: (
      v: DispatchAction<T, FunctionAction<T>>,
    ) => Resolvable<T | undefined>,
  ) {
    if (this.mdAction.length === 0) {
      return finalize(dispatch);
    }

    let idx = 0;
    dispatch._onNext = (nextAction) => {
      dispatch.action = nextAction;
      const m = this.mdAction[idx++]!;
      if (m) {
        return m.onAction!(dispatch);
      }

      return finalize(dispatch);
    };

    const m = this.mdAction[idx++]!;
    return m.onAction!(dispatch);
  }

  applyProcedure(
    dispatch: DispatchAction<T, ProcedureAction<T>>,
    finalize: (
      v: DispatchAction<T, ProcedureAction<T>>,
    ) => Resolvable<T | undefined>,
  ) {
    if (this.mdProcedure.length === 0) {
      return finalize(dispatch);
    }

    let idx = 0;
    dispatch._onNext = (nextAction) => {
      dispatch.action = nextAction;
      const m = this.mdProcedure[idx++]!;
      if (m) {
        return m.onProcedure!(dispatch);
      }

      return finalize(dispatch);
    };

    const m = this.mdProcedure[idx++]!;
    return m.onProcedure!(dispatch);
  }
}
