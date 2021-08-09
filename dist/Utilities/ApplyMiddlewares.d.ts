import type { QuarkContext, StateSetter } from "../Types";
export declare function applyMiddlewares<T, ET>(self: QuarkContext<T, any, ET>, value: StateSetter<T, any>, setterFn: (v: T) => void): void;
