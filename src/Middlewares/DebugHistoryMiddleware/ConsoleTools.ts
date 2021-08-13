import { DateTime } from "luxon";
import type { RecordValue } from "../../Types";
import { hasKey } from "../../Utilities/GeneralPurposeUtilities";
import { addToGlobalSpace } from "./AddToGlobalSpace";
import type {
  HistoricalState,
  HistoryPropertiesKeys,
  QuarkStateChangeHistoricalEntry,
} from "./Types/TrackedQuark";
import { getStateUpdateHistory } from "./UpdateHistory";

const PROPERTIES_FRIENDLY_NAMES_MAP: Record<HistoryPropertiesKeys, string> = {
  value: "Value:",
  type: "Value Type:",
  change: "Value Change is:",
  initialState: "Previous state value:",
  dispatchedUpdate: "Dispatched state value:",
  name: "Quark Name:",
  source: "Update Source:",
  stackTrace: "Stack Trace:",
  stateAfterUpdate: "Next state value:",
  time: "Timestamp:",
};

const columns: HistoryPropertiesKeys[] = [
  "initialState",
  "dispatchedUpdate",
  "stateAfterUpdate",
  "change",
  "source",
  "time",
  "stackTrace",
];

function parseHistoricalStateToString(obj: HistoricalState) {
  return `Type: ${obj.type}; Value: [${obj.value}]`;
}

function printQuarkHistory(options?: { name?: string; showLast?: number }) {
  const { showLast = 16, name = undefined } = options ?? {};

  const history = getStateUpdateHistory();

  const quarksHistories = history.getHistory();

  for (const quarkHistory of quarksHistories) {
    if (!name || quarkHistory.name === name) {
      if (name) console.groupCollapsed(quarkHistory.name);
      else console.group(quarkHistory.name);

      const table = quarkHistory.stateChangeHistory
        .reverse()
        .slice(0, showLast)
        .map((entry) => {
          const columnValues = columns.map((propertyName): [string, unknown] => {
            const friendlyName = PROPERTIES_FRIENDLY_NAMES_MAP[propertyName];
            const value: RecordValue<QuarkStateChangeHistoricalEntry> = hasKey(
              entry,
              propertyName
            )
              ? entry[propertyName]
              : undefined;

            if (typeof value === "object") {
              return [friendlyName, parseHistoricalStateToString(value)];
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
