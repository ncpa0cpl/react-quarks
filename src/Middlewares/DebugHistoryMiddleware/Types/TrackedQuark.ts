export type HistoricalState = {
  value: unknown;
  type: "Promise" | "Generator" | "Value";
};

export type QuarkStateChangeHistoricalEntry = {
  time: number;
  change: "Immediate" | "Postponed";
  initialState: HistoricalState;
  dispatchedUpdate: HistoricalState;
  stateAfterUpdate: unknown;
  source: "Sync-Dispatch" | "Async-Dispatch";
  stackTrace: string | undefined;
};

export type AddHistoryEntryParam = Omit<
  QuarkStateChangeHistoricalEntry,
  "time" | "change" | "stateAfterUpdate"
>;

export type TrackedQuark = {
  name: string;
  stateChangeHistory: QuarkStateChangeHistoricalEntry[];
  addHistoryEntry(entry: AddHistoryEntryParam): void;
  clear(): void;
};

type KeysOf<T extends object> = {
  [K in keyof T]: K extends string ? K : "";
}[keyof T];

export type HistoryPropertiesKeys =
  | KeysOf<HistoricalState>
  | KeysOf<QuarkStateChangeHistoricalEntry>
  | "name";
