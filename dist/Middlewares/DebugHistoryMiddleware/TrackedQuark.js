export function createTrackedQuark(name) {
    const stateChangeHistory = [];
    const addHistoryEntry = (entry) => {
        const change = entry.dispatchedUpdate.type === "Promise" ? "Postponed" : "Immediate";
        stateChangeHistory.push({
            ...entry,
            time: Date.now(),
            change,
            stateAfterUpdate: change === "Immediate"
                ? entry.dispatchedUpdate.value
                : entry.initialState.value,
        });
    };
    return {
        name,
        stateChangeHistory,
        addHistoryEntry,
    };
}
