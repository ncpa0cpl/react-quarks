import { addToGlobalSpace } from "./AddToGlobalSpace";
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

  const clear = () => {
    for (const q of trackedQuarks) {
      q.clear();
    }
  };

  return { track, showHistory, getHistory, clear };
}

let StateUpdateHistory: ReturnType<typeof createStateUpdateHistory> | undefined;

export function getStateUpdateHistory() {
  if (StateUpdateHistory) return StateUpdateHistory;

  StateUpdateHistory = createStateUpdateHistory();

  addToGlobalSpace({ __quark_history_tracker__: StateUpdateHistory });
  initConsoleTools();

  return StateUpdateHistory;
}
