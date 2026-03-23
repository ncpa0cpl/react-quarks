import { FunctionAction } from "..";
import { DispatchAction } from "../Utilities/StateUpdates/ApplyMiddlewares";
import { Resolvable } from "../Utilities/StateUpdates/Immediate";
import { ProcedureAction } from "./Procedures";
import type { DispatchAsync, DispatchFunc } from "./Quark";

export interface QuarkMiddleware<T> {
  onValue?(
    ctx: DispatchAction<T, T>,
  ): Resolvable<T | undefined>;
  onPromise?(
    ctx: DispatchAction<T, DispatchAsync<T>>,
  ): Resolvable<T | undefined>;
  onFunction?(
    ctx: DispatchAction<T, DispatchFunc<T>>,
  ): Resolvable<T | undefined>;
  onAction?(
    ctx: DispatchAction<T, FunctionAction<T>>,
  ): Resolvable<T | undefined>;
  onProcedure?(
    ctx: DispatchAction<T, ProcedureAction<T>>,
  ): Resolvable<T | undefined>;
}
