import { beforeEach, describe, expect, it, vitest } from "vitest";
import {
  asyncUpdatesController,
  CancelablePromise,
  extractIsPromiseCanceled,
} from "../../../src/Utilities/StateUpdates/AsyncUpdates";
import { getTestQuarkContext, sleep } from "../../helpers";

describe("Async Updates", () => {
  describe("CancelablePromise()", () => {
    const consoleErrorMock = vitest.fn();

    beforeEach(() => {
      vitest.resetAllMocks();
      vitest.spyOn(console, "error").mockImplementation(consoleErrorMock);
    });

    describe("with resolved promise", () => {
      it("should propagate thenable function", async () => {
        const myPromise = Promise.resolve("foo");

        const cancelablePromise = CancelablePromise(myPromise);

        const onResolve = vitest.fn();

        cancelablePromise.then(onResolve);

        await sleep(0);

        expect(extractIsPromiseCanceled(myPromise)).toEqual(false);
        expect(onResolve).toHaveBeenCalledTimes(1);
        expect(onResolve).toHaveBeenCalledWith("foo");

        expect(consoleErrorMock).toHaveBeenCalledTimes(0);
      });

      it("should prevent thenable function from executing when canceled", async () => {
        const myPromise = Promise.resolve("foo");

        const cancelablePromise = CancelablePromise(myPromise);

        const onResolve = vitest.fn();

        cancelablePromise.then(onResolve);

        cancelablePromise.cancel();

        await sleep(0);

        expect(extractIsPromiseCanceled(myPromise)).toEqual(true);
        expect(onResolve).toHaveBeenCalledTimes(0);

        expect(consoleErrorMock).toHaveBeenCalledTimes(0);
      });
    });

    describe("with rejected promise", () => {
      it("should log the error, and not execute the thenable", async () => {
        const myPromise = Promise.reject(new Error("bar"));

        const cancelablePromise = CancelablePromise(myPromise);

        const onResolve = vitest.fn();

        cancelablePromise.then(onResolve).catch(() => {});

        await sleep(0);

        expect(extractIsPromiseCanceled(myPromise)).toEqual(false);
        expect(onResolve).toHaveBeenCalledTimes(0);

        expect(consoleErrorMock).toHaveBeenCalledTimes(1);
        expect(consoleErrorMock).toHaveBeenCalledWith(
          new Error(
            "Asynchronous state update was unsuccessful due to an error. [bar]"
          )
        );
      });

      it("should not execute the thenable when canceled nor log it", async () => {
        const myPromise = Promise.reject("bar");

        const cancelablePromise = CancelablePromise(myPromise);

        const onResolve = vitest.fn();

        cancelablePromise.then(onResolve).catch(() => {});

        cancelablePromise.cancel();

        await sleep(0);

        expect(extractIsPromiseCanceled(myPromise)).toEqual(true);
        expect(onResolve).toHaveBeenCalledTimes(0);

        expect(consoleErrorMock).toHaveBeenCalledTimes(0);
      });
    });
  });

  describe("asyncUpdatesController()", () => {
    it("when allowRaceConditions option is enabled updates are not canceled", async () => {
      const controller = asyncUpdatesController(
        getTestQuarkContext({ configOptions: { allowRaceConditions: true } })
      );

      const myPromise = Promise.resolve("foo");

      const setStateMock = vitest.fn();

      controller.dispatchAsyncUpdate(myPromise, setStateMock);

      controller.preventLastAsyncUpdate();

      await sleep(0);

      expect(setStateMock).toHaveBeenCalledTimes(1);
      expect(extractIsPromiseCanceled(myPromise)).toEqual(false);
    });

    it("when allowRaceConditions option is disabled updates are canceled", async () => {
      const controller = asyncUpdatesController(
        getTestQuarkContext({ configOptions: { allowRaceConditions: false } })
      );

      const myPromise = Promise.resolve("foo");

      const setStateMock = vitest.fn();

      controller.dispatchAsyncUpdate(myPromise, setStateMock);

      controller.preventLastAsyncUpdate();

      await sleep(0);

      expect(setStateMock).toHaveBeenCalledTimes(0);
      expect(extractIsPromiseCanceled(myPromise)).toEqual(true);
    });

    it("consecutive dispatches should cancel the previous updates", async () => {
      const controller = asyncUpdatesController(getTestQuarkContext());

      const myPromise1 = Promise.resolve("foo");
      const myPromise2 = Promise.resolve("bar");
      const myPromise3 = Promise.resolve("baz");

      const setStateMock = vitest.fn();

      controller.dispatchAsyncUpdate(myPromise1, setStateMock);
      controller.dispatchAsyncUpdate(myPromise2, setStateMock);
      controller.dispatchAsyncUpdate(myPromise3, setStateMock);

      await sleep(0);

      expect(setStateMock).toHaveBeenCalledTimes(1);
      expect(setStateMock).toHaveBeenLastCalledWith("baz");

      expect(extractIsPromiseCanceled(myPromise1)).toEqual(true);
      expect(extractIsPromiseCanceled(myPromise2)).toEqual(true);
      expect(extractIsPromiseCanceled(myPromise3)).toEqual(false);
    });
  });
});
