export declare type HistoricalState = {
    value: unknown;
    type: "Promise" | "Generator" | "Value";
};
export declare type QuarkStateChangeHistoricalEntry = {
    time: number;
    change: "Immediate" | "Postponed";
    initialState: HistoricalState;
    dispatchedUpdate: HistoricalState;
    stateAfterUpdate: unknown;
    source: "Sync-Dispatch" | "Async-Dispatch";
    stackTrace: string | undefined;
    isCanceled?: true;
};
export declare type AddHistoryEntryParam = Omit<QuarkStateChangeHistoricalEntry, "time" | "change" | "stateAfterUpdate">;
export declare type TrackedQuarkParams = {
    name: string;
    realTimeLogging: boolean;
    useTablePrint: boolean;
};
export declare type TrackedQuark = {
    options: TrackedQuarkParams;
    name: string;
    stateChangeHistory: QuarkStateChangeHistoricalEntry[];
    addHistoryEntry(entry: AddHistoryEntryParam): void;
    clear(): void;
};
declare type KeysOf<T extends object> = {
    [K in keyof T]: K extends string ? K : "";
}[keyof T];
export declare type HistoryPropertiesKeys = Exclude<KeysOf<HistoricalState> | KeysOf<QuarkStateChangeHistoricalEntry> | "name", undefined>;
export {};
