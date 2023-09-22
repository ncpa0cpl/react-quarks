import { DateTime } from "luxon";
import type { RecordValue } from "../../Types";
import { hasKey } from "../../Utilities/GeneralPurposeUtilities";
import type {
  HistoricalState,
  HistoryPropertiesKeys,
  QuarkStateChangeHistoricalEntry,
} from "./Types/TrackedQuark";

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
  isCanceled: "Canceled:",
};

const columns: HistoryPropertiesKeys[] = [
  "initialState",
  "dispatchedUpdate",
  "stateAfterUpdate",
  "isCanceled",
  "change",
  "source",
  "time",
  "stackTrace",
];

function stringifyIfObject(v: unknown) {
  if (typeof v === "object") {
    if (v instanceof Promise) return "Promise {}";
    if (v !== null) return JSON.stringify(v);
    return "null";
  }
  return v;
}

function parseObjectValue(obj: HistoricalState) {
  if ("type" in obj && "value" in obj)
    return `Type: ${obj.type}; Value: [${stringifyIfObject(obj.value)}]`;

  return `Type: Value; Value: [${stringifyIfObject(obj)}]`;
}

export function entryToReadableForm(entry: QuarkStateChangeHistoricalEntry) {
  const columnValues = columns.map(
    (propertyName: HistoryPropertiesKeys): [string, unknown] => {
      const friendlyName = PROPERTIES_FRIENDLY_NAMES_MAP[propertyName];
      const value: RecordValue<QuarkStateChangeHistoricalEntry> = hasKey(
        entry,
        propertyName,
      )
        ? entry[propertyName]
        : undefined;

      if (typeof value === "object") {
        return [friendlyName, parseObjectValue(value)];
      }

      if (propertyName === "time") {
        return [friendlyName, DateTime.fromMillis(value as number).toISO()];
      }

      if (propertyName === "isCanceled") {
        return [friendlyName, !!value];
      }

      return [friendlyName, value];
    },
  );

  return Object.fromEntries(columnValues);
}
