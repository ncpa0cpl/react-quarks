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
    const newEntry: QuarkStateChangeHistoricalEntry = {
      ...entry,
      time: DateTime.now().toMillis(),
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
