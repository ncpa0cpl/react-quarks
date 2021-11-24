"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTrackedQuark = void 0;
const luxon_1 = require("luxon");
const EntryToReadableForm_1 = require("./EntryToReadableForm");
function createTrackedQuark(options) {
    const stateChangeHistory = [];
    const onEntryAdded = options.realTimeLogging
        ? (entry) => {
            console.group(options.name);
            if (options.useTablePrint)
                console.table([(0, EntryToReadableForm_1.entryToReadableForm)(entry)]);
            else
                console.log((0, EntryToReadableForm_1.entryToReadableForm)(entry));
            console.groupEnd();
        }
        : () => { };
    const addHistoryEntry = (entry) => {
        const change = ["Promise", "Generator"].includes(entry.dispatchedUpdate.type)
            ? "Postponed"
            : "Immediate";
        const newEntry = {
            ...entry,
            time: luxon_1.DateTime.now().toMillis(),
            change,
            stateAfterUpdate: change === "Postponed"
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
exports.createTrackedQuark = createTrackedQuark;
