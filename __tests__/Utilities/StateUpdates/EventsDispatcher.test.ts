import { describe, expect, it, vitest } from "vitest";
import { createEventsDebouncer } from "../../../src/Utilities/StateUpdates/EventsDispatcher";
import { sleep } from "../../helpers";

describe("createEventsDispatcher", () => {
  it("should only execute the latest dispatched event when multiple actions are dispatched simultaneously", async () => {
    const events = createEventsDebouncer();

    const ev1 = vitest.fn();
    const ev2 = vitest.fn();
    const ev3 = vitest.fn();
    const ev4 = vitest.fn();
    const ev5 = vitest.fn();

    events.debounceEvent(ev1);
    events.debounceEvent(ev2);
    events.debounceEvent(ev3);
    events.debounceEvent(ev4);
    events.debounceEvent(ev5);

    await sleep(1);

    expect(ev1).toHaveBeenCalledTimes(0);
    expect(ev2).toHaveBeenCalledTimes(0);
    expect(ev3).toHaveBeenCalledTimes(0);
    expect(ev4).toHaveBeenCalledTimes(0);
    expect(ev5).toHaveBeenCalledTimes(1);
  });

  it("should allow for all dispatched events to execute if not dispatched simultaneously", async () => {
    const events = createEventsDebouncer();

    const ev1 = vitest.fn();
    const ev2 = vitest.fn();
    const ev3 = vitest.fn();
    const ev4 = vitest.fn();
    const ev5 = vitest.fn();

    events.debounceEvent(ev1);
    await sleep(0);
    events.debounceEvent(ev2);
    await sleep(0);
    events.debounceEvent(ev3);
    await sleep(0);
    events.debounceEvent(ev4);
    await sleep(0);
    events.debounceEvent(ev5);

    await sleep(1);

    expect(ev1).toHaveBeenCalledTimes(1);
    expect(ev2).toHaveBeenCalledTimes(1);
    expect(ev3).toHaveBeenCalledTimes(1);
    expect(ev4).toHaveBeenCalledTimes(1);
    expect(ev5).toHaveBeenCalledTimes(1);
  });
});
