import { describe, expect, it, vitest } from "vitest";
import { createEventsDebouncer } from "../../../src/Utilities/StateUpdates/EventsDispatcher";
import { processStateUpdate } from "../../../src/Utilities/StateUpdates/ProcessStateUpdate";
import { getTestQuarkContext, sleep } from "../../helpers";

describe("processStateUpdate", () => {
  it("should run the side effects if the state changed", () => {
    const self = getTestQuarkContext({
      value: "foo",
      stateComparator: () => true,
      sideEffect: vitest.fn(),
    });

    const setFnMock = vitest.fn();

    processStateUpdate({
      self,
      previousState: "bar",
      applyMiddlewaresAndUpdateState: setFnMock,
      debounceEvent: vitest.fn(),
    });

    expect(self.sideEffect).toHaveBeenCalledWith("bar", "foo", setFnMock);
  });

  it("should not run the side effects if the state did not changed", () => {
    const self = getTestQuarkContext({
      value: "foo",
      stateComparator: () => false,
      sideEffect: vitest.fn(),
    });

    const setFnMock = vitest.fn();

    processStateUpdate({
      self,
      previousState: "bar",
      applyMiddlewaresAndUpdateState: setFnMock,
      debounceEvent: vitest.fn(),
    });

    expect(self.sideEffect).toHaveBeenCalledTimes(0);
  });

  it("should notify subscribers if the state changed", async () => {
    const subOne = vitest.fn();
    const subTwo = vitest.fn();

    const { debounceEvent } = createEventsDebouncer();
    const self = getTestQuarkContext({
      value: "foo",
      stateComparator: () => true,
      sideEffect: vitest.fn(),
      subscribers: new Set([subOne, subTwo]),
    });

    const setFnMock = vitest.fn();
    const dispatchEventMock = vitest.fn(debounceEvent);

    processStateUpdate({
      self,
      previousState: "bar",
      applyMiddlewaresAndUpdateState: setFnMock,
      debounceEvent: dispatchEventMock,
    });

    expect(dispatchEventMock).toHaveBeenCalledTimes(1);
    expect(dispatchEventMock).toHaveBeenCalledWith(expect.any(Function));

    // subscription calls happen in the next microtask,
    // so it's not called yet at this point
    expect(subOne).toHaveBeenCalledTimes(0);

    await sleep(0); // let the microtasks run

    expect(subOne).toHaveBeenCalledTimes(1);
    expect(subOne).toHaveBeenCalledWith("foo");

    expect(subTwo).toHaveBeenCalledTimes(1);
    expect(subTwo).toHaveBeenCalledWith("foo");
  });

  it("should notify all of the subscribers even if they were not present at the time of state update or have been removed at the last moment", async () => {
    const subOne = vitest.fn();
    const subTwo = vitest.fn();
    const subThree = vitest.fn();
    const subFour = vitest.fn();

    const self = getTestQuarkContext({
      value: "foo",
      stateComparator: () => true,
      sideEffect: vitest.fn(),
      subscribers: new Set([subOne, subTwo, subThree]),
    });

    const setFnMock = vitest.fn();

    const { debounceEvent } = createEventsDebouncer();

    processStateUpdate({
      self,
      previousState: "bar",
      applyMiddlewaresAndUpdateState: setFnMock,
      debounceEvent: debounceEvent,
    });

    expect(subOne).toHaveBeenCalledTimes(0);
    expect(subTwo).toHaveBeenCalledTimes(0);
    expect(subThree).toHaveBeenCalledTimes(0);
    expect(subFour).toHaveBeenCalledTimes(0);

    self.subscribers.delete(subOne);
    self.subscribers.add(subFour);

    await sleep(0); // let the microtasks run

    expect(subOne).toHaveBeenCalledTimes(0);
    expect(subTwo).toHaveBeenCalledTimes(1);
    expect(subThree).toHaveBeenCalledTimes(1);
    expect(subFour).toHaveBeenCalledTimes(1);
  });
});
