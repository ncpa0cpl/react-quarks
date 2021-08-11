import type {
  AddHistoryEntryParam,
  QuarkStateChangeHistoricalEntry,
  TrackedQuark,
} from "./Types/TrackedQuark";

export function createTrackedQuark(name: string): TrackedQuark {
  const stateChangeHistory: QuarkStateChangeHistoricalEntry[] = [];

  const addHistoryEntry = (entry: AddHistoryEntryParam) => {
    const change =
      entry.dispatchedUpdate.type === "Promise" ? "Postponed" : "Immediate";

    stateChangeHistory.push({
      ...entry,
      time: Date.now(),
      change,
      stateAfterUpdate:
        change === "Immediate"
          ? entry.dispatchedUpdate.value
          : entry.initialState.value,
    });
  };

  return {
    name,
    stateChangeHistory,
    addHistoryEntry,
  };
}
