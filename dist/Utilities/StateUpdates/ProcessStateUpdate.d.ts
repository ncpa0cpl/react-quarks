import type { QuarkContext, StateSetter } from "../../Types";
export declare function processStateUpdate<T, A, ET>(params: {
    self: QuarkContext<T, A, ET>;
    previousState: T;
    omitNotifyingSubscribers: boolean;
    updateStateWithMiddlewares: (v: StateSetter<T, ET>) => void;
}): void;
