import type { QuarkContext, QuarkUpdateType, StateSetter } from "../Types";
export declare function applyMiddlewares<T, ET>(self: QuarkContext<T, any, ET>, value: StateSetter<T, ET>, type: QuarkUpdateType, setterFn: (v: StateSetter<T, never>) => void): void;
