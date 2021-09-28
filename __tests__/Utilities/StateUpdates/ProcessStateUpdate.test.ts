import { processStateUpdate } from "../../../src/Utilities/StateUpdates/ProcessStateUpdate";
import { getTestQuarkContext } from "../../helpers";

describe("processStateUpdate", () => {
  it("should run the side effects if the state changed", () => {
    const self = getTestQuarkContext({
      value: "foo",
      stateComparator: () => true,
      sideEffect: jest.fn(),
    });

    const setFnMock = jest.fn();

    processStateUpdate({
      self,
      previousState: "bar",
      applyMiddlewaresAndUpdateState: setFnMock,
      dispatchEvent: jest.fn(),
    });

    expect(self.sideEffect).toHaveBeenCalledWith("bar", "foo", setFnMock);
  });

  it("should not run the side effects if the state did not changed", () => {
    const self = getTestQuarkContext({
      value: "foo",
      stateComparator: () => false,
      sideEffect: jest.fn(),
    });

    const setFnMock = jest.fn();

    processStateUpdate({
      self,
      previousState: "bar",
      applyMiddlewaresAndUpdateState: setFnMock,
      dispatchEvent: jest.fn(),
    });

    expect(self.sideEffect).toHaveBeenCalledTimes(0);
  });

  it("should notify subscribers if the state changed", () => {
    const subOne = jest.fn();
    const subTwo = jest.fn();

    const self = getTestQuarkContext({
      value: "foo",
      stateComparator: () => true,
      sideEffect: jest.fn(),
      subscribers: new Set([subOne, subTwo]),
    });

    const setFnMock = jest.fn();
    const dispatchEventMock = jest.fn((ev: Function) => ev());

    processStateUpdate({
      self,
      previousState: "bar",
      applyMiddlewaresAndUpdateState: setFnMock,
      dispatchEvent: dispatchEventMock,
    });

    expect(dispatchEventMock).toHaveBeenCalledTimes(1);
    expect(dispatchEventMock).toHaveBeenCalledWith(expect.any(Function));

    expect(subOne).toHaveBeenCalledTimes(1);
    expect(subOne).toHaveBeenCalledWith("foo");

    expect(subTwo).toHaveBeenCalledTimes(1);
    expect(subTwo).toHaveBeenCalledWith("foo");
  });

  it("should notify all of the subscribers that were present at the time of state update and only those", () => {
    const subOne = jest.fn();
    const subTwo = jest.fn();
    const subThree = jest.fn();
    const subFour = jest.fn();

    const self = getTestQuarkContext({
      value: "foo",
      stateComparator: () => true,
      sideEffect: jest.fn(),
      subscribers: new Set([subOne, subTwo, subThree]),
    });

    let dispatchedFn: Function = () => {};

    const setFnMock = jest.fn();
    const dispatchEventMock = jest.fn((ev: Function) => {
      dispatchedFn = ev;
    });

    processStateUpdate({
      self,
      previousState: "bar",
      applyMiddlewaresAndUpdateState: setFnMock,
      dispatchEvent: dispatchEventMock,
    });

    expect(dispatchEventMock).toHaveBeenCalledTimes(1);

    expect(subOne).toHaveBeenCalledTimes(0);
    expect(subTwo).toHaveBeenCalledTimes(0);
    expect(subThree).toHaveBeenCalledTimes(0);
    expect(subFour).toHaveBeenCalledTimes(0);

    self.subscribers.delete(subOne);
    self.subscribers.add(subFour);

    dispatchedFn();

    expect(subOne).toHaveBeenCalledTimes(1);
    expect(subTwo).toHaveBeenCalledTimes(1);
    expect(subThree).toHaveBeenCalledTimes(1);
    expect(subFour).toHaveBeenCalledTimes(0);
  });
});
