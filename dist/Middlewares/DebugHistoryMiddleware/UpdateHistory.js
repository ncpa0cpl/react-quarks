"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStateUpdateHistory = void 0;
const AddToGlobalSpace_1 = require("./AddToGlobalSpace");
const ConsoleTools_1 = require("./ConsoleTools");
const TrackedQuark_1 = require("./TrackedQuark");
function createStateUpdateHistory() {
    const trackedQuarks = [];
    const track = (options) => {
        const quarkTrack = (0, TrackedQuark_1.createTrackedQuark)(options);
        trackedQuarks.push(quarkTrack);
        return quarkTrack;
    };
    const getHistory = () => {
        return trackedQuarks.map((t) => ({
            options: t.options,
            name: t.name,
            stateChangeHistory: t.stateChangeHistory,
        }));
    };
    const showHistory = () => {
        return Object.fromEntries(trackedQuarks.map((trackedQuark, index) => {
            return [`${index}_${trackedQuark.name}`, trackedQuark.stateChangeHistory];
        }));
    };
    const clear = () => {
        for (const q of trackedQuarks) {
            q.clear();
        }
    };
    return { track, showHistory, getHistory, clear };
}
let StateUpdateHistory;
function getStateUpdateHistory() {
    if (StateUpdateHistory)
        return StateUpdateHistory;
    StateUpdateHistory = createStateUpdateHistory();
    (0, AddToGlobalSpace_1.addToGlobalSpace)({ __quark_history_tracker__: StateUpdateHistory });
    (0, ConsoleTools_1.initConsoleTools)();
    return StateUpdateHistory;
}
exports.getStateUpdateHistory = getStateUpdateHistory;
