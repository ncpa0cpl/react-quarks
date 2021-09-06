import type { QuarkSetterFn } from "./Quark";
export declare type QuarkCustomEffect<T, ET> = (previousState: T, newState: T, set: QuarkSetterFn<T, ET>) => void;
export declare type QuarkEffects<T, ET> = Record<string, QuarkCustomEffect<T, ET>>;
