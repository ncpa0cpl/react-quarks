"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initConsoleTools = void 0;
const AddToGlobalSpace_1 = require("./AddToGlobalSpace");
const EntryToReadableForm_1 = require("./EntryToReadableForm");
const UpdateHistory_1 = require("./UpdateHistory");
function printQuarkHistory(options) {
    const { showLast = 16, name = undefined } = options ?? {};
    const history = UpdateHistory_1.getStateUpdateHistory();
    const quarksHistories = history.getHistory();
    for (const quarkHistory of quarksHistories) {
        const useTablePrint = options?.useTablePrint ?? quarkHistory.options.useTablePrint;
        if (!name || quarkHistory.name === name) {
            if (name)
                console.groupCollapsed(quarkHistory.name);
            else
                console.group(quarkHistory.name);
            const table = [...quarkHistory.stateChangeHistory]
                .reverse()
                .slice(0, showLast)
                .reverse()
                .map(EntryToReadableForm_1.entryToReadableForm);
            if (useTablePrint)
                console.table(table);
            else
                console.log(table);
            console.groupEnd();
        }
    }
}
function initConsoleTools() {
    AddToGlobalSpace_1.addToGlobalSpace({ printQuarkHistory });
}
exports.initConsoleTools = initConsoleTools;
