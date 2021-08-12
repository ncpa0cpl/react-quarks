import { DateTime } from "luxon";
import { hasKey } from "../../Utilities/GeneralPurposeUtilities";
import { addToGlobalSpace } from "./AddToGlobalSpace";
import { StateUpdateHistory } from "./UpdateHistory";
const PROPERTIES_FRIENDLY_NAMES_MAP = {
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
function parseHistoricalStateToString(obj) {
    return `Type: ${obj.type}; Value: [${obj.value}]`;
}
function printQuarkHistory(options) {
    const { showLast = 16, name = undefined } = options ?? {};
    const history = StateUpdateHistory;
    const quarksHistories = history.getHistory();
    const columns = [
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
                const columnValues = columns.map((propertyName) => {
                    const friendlyName = PROPERTIES_FRIENDLY_NAMES_MAP[propertyName];
                    const value = hasKey(entry, propertyName)
                        ? entry[propertyName]
                        : undefined;
                    if (typeof value === "object") {
                        return [
                            friendlyName,
                            parseHistoricalStateToString(value),
                        ];
                    }
                    if (propertyName === "time") {
                        return [friendlyName, DateTime.fromMillis(value).toISO()];
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
