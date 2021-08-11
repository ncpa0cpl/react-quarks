import type { QuarkContext, StateSetter } from "../Types";
export declare function applyMiddlewares<T, ET>(self: QuarkContext<T, any, ET>, value: StateSetter<T, ET>, setterFn: (v: StateSetter<T, never>) => void): void;
