import type { QuarkContext } from "../../Types";
export declare function extractIsPromiseCanceled(promise: unknown): boolean | undefined;
export declare type AsyncUpdateController<T> = {
    dispatchAsyncUpdate: (p: Promise<T>, stateUpdate: (state: T) => void) => void;
    preventLastAsyncUpdate: () => void;
};
export declare function asyncUpdatesController<T>(self: QuarkContext<T, any, any>): AsyncUpdateController<T>;
