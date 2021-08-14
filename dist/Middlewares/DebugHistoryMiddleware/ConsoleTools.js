import { addToGlobalSpace } from "./AddToGlobalSpace";
import { entryToReadableForm } from "./EntryToReadableForm";
import { getStateUpdateHistory } from "./UpdateHistory";
function printQuarkHistory(options) {
    const { showLast = 16, name = undefined } = options ?? {};
    const history = getStateUpdateHistory();
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
                .map(entryToReadableForm);
            if (useTablePrint)
                console.table(table);
            else
                console.log(table);
            console.groupEnd();
        }
    }
}
export function initConsoleTools() {
    addToGlobalSpace({ printQuarkHistory });
}
