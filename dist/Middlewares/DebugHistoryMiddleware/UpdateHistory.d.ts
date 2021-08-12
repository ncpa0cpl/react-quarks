import type { TrackedQuark } from "./Types/TrackedQuark";
export declare const StateUpdateHistory: {
    track: (name: string) => TrackedQuark;
    showHistory: () => {
        [k: string]: import("./Types/TrackedQuark").QuarkStateChangeHistoricalEntry[];
    };
    getHistory: () => {
        name: string;
        stateChangeHistory: import("./Types/TrackedQuark").QuarkStateChangeHistoricalEntry[];
    }[];
};
