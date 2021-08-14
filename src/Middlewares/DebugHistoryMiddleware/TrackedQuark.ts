import { DateTime } from "luxon";
import type {
  AddHistoryEntryParam,
  QuarkStateChangeHistoricalEntry,
  TrackedQuark,
} from "./Types/TrackedQuark";

export function createTrackedQuark(name: string): TrackedQuark {
  const stateChangeHistory: QuarkStateChangeHistoricalEntry[] = [];

  const addHistoryEntry = (entry: AddHistoryEntryParam) => {
    const change = ["Promise", "Generator"].includes(entry.dispatchedUpdate.type)
      ? "Postponed"
      : "Immediate";

    stateChangeHistory.push({
      ...entry,
      time: DateTime.now().toMillis(),
      change,
      stateAfterUpdate:
        change === "Postponed"
          ? entry.initialState.value
          : typeof entry.dispatchedUpdate.value === "function"
          ? entry.dispatchedUpdate.value(entry.initialState.value)
          : entry.dispatchedUpdate.value,
    });
  };

  const clear = () => {
    stateChangeHistory.splice(0);
  };

  return {
    name,
    stateChangeHistory,
    addHistoryEntry,
    clear,
  };
}
