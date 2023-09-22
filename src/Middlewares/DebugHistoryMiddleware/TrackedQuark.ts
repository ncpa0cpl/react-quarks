import { DateTime } from "luxon";
import { entryToReadableForm } from "./EntryToReadableForm";
import type {
  AddHistoryEntryParam,
  QuarkStateChangeHistoricalEntry,
  TrackedQuark,
  TrackedQuarkParams,
} from "./Types/TrackedQuark";

export function createTrackedQuark(options: TrackedQuarkParams): TrackedQuark {
  const stateChangeHistory: QuarkStateChangeHistoricalEntry[] = [];

  const onEntryAdded = options.realTimeLogging
    ? (entry: QuarkStateChangeHistoricalEntry) => {
        console.group(options.name);
        if (options.useTablePrint) console.table([entryToReadableForm(entry)]);
        else console.log(entryToReadableForm(entry));
        console.groupEnd();
      }
    : () => {};

  const addHistoryEntry = (entry: AddHistoryEntryParam) => {
    const change = ["Promise", "Generator"].includes(
      entry.dispatchedUpdate.type,
    )
      ? "Postponed"
      : "Immediate";

    const newEntry: QuarkStateChangeHistoricalEntry = {
      ...entry,
      time: DateTime.now().toMillis(),
      change,
      stateAfterUpdate:
        change === "Postponed"
          ? entry.initialState.value
          : entry.dispatchedUpdate.value,
    };

    stateChangeHistory.push(newEntry);

    onEntryAdded(newEntry);
  };

  const clear = () => {
    stateChangeHistory.splice(0);
  };

  return {
    options,
    name: options.name,
    stateChangeHistory,
    addHistoryEntry,
    clear,
  };
}
