export function createTrackedQuark(name) {
    const stateChangeHistory = [];
    const addHistoryEntry = (entry) => {
        const change = entry.dispatchedUpdate.type === "Promise" ? "Postponed" : "Immediate";
        stateChangeHistory.push({
            ...entry,
            time: Date.now(),
            change,
            stateAfterUpdate: change === "Postponed"
                ? entry.initialState.value
                : typeof entry.dispatchedUpdate.value === "function"
                    ? entry.dispatchedUpdate.value(entry.initialState.value)
                    : entry.dispatchedUpdate.value,
        });
    };
    return {
        name,
        stateChangeHistory,
        addHistoryEntry,
    };
}
