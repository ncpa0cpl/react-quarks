import { DateTime } from "luxon";
import { hasKey } from "../../Utilities/GeneralPurposeUtilities";
import { addToGlobalSpace } from "./AddToGlobalSpace";
import type { HistoricalState, HistoryPropertiesKeys } from "./Types/TrackedQuark";
import { StateUpdateHistory } from "./UpdateHistory";

const PROPERTIES_FRIENDLY_NAMES_MAP: Record<HistoryPropertiesKeys, string> = {
  value: "Value:",
  type: "Value Type:",
  change: "Value Change is:",
  initialState: "Quark State Value before update:",
  dispatchedUpdate: "Dispatched Value:",
  name: "Quark Name:",
  source: "Update Source:",
  stackTrace: "Stack Trace:",
  stateAfterUpdate: "State Value after applying this update:",
  time: "Timestamp:",
};

function parseHistoricalStateToString(obj: HistoricalState) {
  return `Type: ${obj.type}; Value: [${obj.value}]`;
}

function printQuarkHistory(options?: { name?: string; showLast?: number }) {
  const { showLast = 16, name = undefined } = options ?? {};

  const history = StateUpdateHistory;

  const quarksHistories = history.getHistory();

  const columns: HistoryPropertiesKeys[] = [
    "initialState",
    "dispatchedUpdate",
    "stateAfterUpdate",
    "change",
    "source",
    "time",
    "stackTrace",
  ];

  for (const quarkHistory of quarksHistories) {
    if (!name || quarkHistory.name === name) {
      console.group(quarkHistory.name);

      const table = quarkHistory.stateChangeHistory
        .reverse()
        .slice(0, showLast)
        .map((entry) => {
          const columnValues = columns.map((propertyName): [string, unknown] => {
            const friendlyName = PROPERTIES_FRIENDLY_NAMES_MAP[propertyName];
            const value = hasKey(entry, propertyName)
              ? entry[propertyName]
              : undefined;

            if (typeof value === "object") {
              return [
                friendlyName,
                parseHistoricalStateToString(value as HistoricalState),
              ];
            }

            if (propertyName === "time") {
              return [friendlyName, DateTime.fromMillis(value as number).toISO()];
            }

            return [friendlyName, value];
          });

          return Object.fromEntries(columnValues);
        })
        .reverse();

      console.table(table);
      console.groupEnd();
    }
  }
}

export function initConsoleTools() {
  addToGlobalSpace({ printQuarkHistory });
}
