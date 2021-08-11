import { createTrackedQuark } from "./TrackedQuark";
function createStateUpdateHistory() {
    const trackedQuarks = [];
    const track = (name) => {
        const quarkTrack = createTrackedQuark(name);
        trackedQuarks.push(quarkTrack);
        return quarkTrack;
    };
    const showHistory = () => {
        return Object.fromEntries(trackedQuarks.map((trackedQuark, index) => {
            return [`${index}_${trackedQuark.name}`, trackedQuark.stateChangeHistory];
        }));
    };
    return { track, showHistory };
}
export const StateUpdateHistory = createStateUpdateHistory();
if (global.window) {
    Object.assign(global.window, { __quark_history_tracker__: StateUpdateHistory });
}
else if (global) {
    Object.assign(global, { __quark_history_tracker__: StateUpdateHistory });
}
