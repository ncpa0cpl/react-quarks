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
        change === "Postponed"
          ? entry.initialState.value
          : typeof entry.dispatchedUpdate.value === "function"
          ? entry.dispatchedUpdate.value(entry.initialState.value)
          : entry.dispatchedUpdate.value,
    });
  };

  return {
    name,
    stateChangeHistory,
    addHistoryEntry,
  };
}
