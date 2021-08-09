import type { QuarkSetterFn } from "./Quark";
export declare type QuarkCustomEffect<T, A> = (previousState: T, newState: T, stateActions: A & {
    set: QuarkSetterFn<T>;
}) => void;
export declare type QuarkEffects<T, A> = Record<string, QuarkCustomEffect<T, A>>;
