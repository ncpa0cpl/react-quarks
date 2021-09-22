import type { QuarkContext } from "..";
export declare function generateSubscribeFunction<T, ET>(self: QuarkContext<T, ET>): (onStateChange: (state: T, cancelSubscription: () => void) => void) => {
    cancel(): void;
};
