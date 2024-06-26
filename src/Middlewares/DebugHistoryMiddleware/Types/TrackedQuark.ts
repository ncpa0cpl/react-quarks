export type HistoricalState = {
  value: unknown;
  type: "Promise" | "Function" | "Value" | "AsyncGenerator";
};

export type DispatchSource =
  | "Sync-Dispatch"
  | "Async-Dispatch"
  | "Function-Dispatch"
  | "Async-Generator-Dispatch";

export type QuarkStateChangeHistoricalEntry = {
  updateID: string;
  time: number;
  source: DispatchSource;
  initialState: HistoricalState;
  dispatchedUpdate: HistoricalState;
  stackTrace: string | undefined;
  isCanceled?: boolean;
};

export type AddHistoryEntryParam = Omit<
  QuarkStateChangeHistoricalEntry,
  "time" | "change" | "stateAfterUpdate"
>;

export type TrackedQuarkParams = {
  name: string;
  realTimeLogging: boolean;
  useTablePrint: boolean;
};

export type TrackedQuark = {
  options: TrackedQuarkParams;
  name: string;
  stateChangeHistory: QuarkStateChangeHistoricalEntry[];
  addHistoryEntry(entry: AddHistoryEntryParam): void;
  clear(): void;
};

type KeysOf<T extends object> = {
  [K in keyof T]: K extends string ? K : "";
}[keyof T];

export type HistoryPropertiesKeys = Exclude<
  KeysOf<HistoricalState> | KeysOf<QuarkStateChangeHistoricalEntry> | "name",
  undefined
>;
