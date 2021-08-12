import { initConsoleTools } from "./ConsoleTools";
import { createTrackedQuark } from "./TrackedQuark";
import type { TrackedQuark } from "./Types/TrackedQuark";

function createStateUpdateHistory() {
  const trackedQuarks: TrackedQuark[] = [];

  const track = (name: string) => {
    const quarkTrack = createTrackedQuark(name);
    trackedQuarks.push(quarkTrack);
    return quarkTrack;
  };

  const getHistory = () => {
    return trackedQuarks.map((t) => ({
      name: t.name,
      stateChangeHistory: t.stateChangeHistory,
    }));
  };

  const showHistory = () => {
    return Object.fromEntries(
      trackedQuarks.map((trackedQuark, index) => {
        return [`${index}_${trackedQuark.name}`, trackedQuark.stateChangeHistory];
      })
    );
  };

  return { track, showHistory, getHistory };
}

export const StateUpdateHistory = createStateUpdateHistory();

if (global.window) {
  Object.assign(global.window, { __quark_history_tracker__: StateUpdateHistory });
} else if (global) {
  Object.assign(global, { __quark_history_tracker__: StateUpdateHistory });
}

initConsoleTools();
