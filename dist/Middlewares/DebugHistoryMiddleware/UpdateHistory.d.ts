import type { TrackedQuark, TrackedQuarkParams } from "./Types/TrackedQuark";
export declare function getStateUpdateHistory(): {
    track: (options: TrackedQuarkParams) => TrackedQuark;
    showHistory: () => {
        [k: string]: import("./Types/TrackedQuark").QuarkStateChangeHistoricalEntry[];
    };
    getHistory: () => {
        options: TrackedQuarkParams;
        name: string;
        stateChangeHistory: import("./Types/TrackedQuark").QuarkStateChangeHistoricalEntry[];
    }[];
    clear: () => void;
};
