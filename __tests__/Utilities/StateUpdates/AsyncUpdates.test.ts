import { describe, expect, it, vitest } from "vitest";
import { createUpdateController } from "../../../src/Utilities/StateUpdates/AsyncUpdates";
import { getTestQuarkContext, sleep } from "../../helpers";

describe("Async Updates", () => {
  describe("asyncUpdatesController()", () => {
    it("when allowRaceConditions option is enabled updates are not canceled", async () => {
      const context = getTestQuarkContext({
        configOptions: { allowRaceConditions: true },
      });
      const setStateMock = vitest.fn((v: string) => {
        context.value = v;
      });

      const controller = createUpdateController(context, setStateMock);

      const myPromise = Promise.resolve("foo");

      const p1Updater = controller.atomicUpdate();
      myPromise.then((v) => {
        p1Updater.update(v);
      });

      p1Updater.cancel();

      await sleep(0);

      expect(setStateMock).toHaveBeenCalledTimes(1);
      expect(context.value).toEqual("foo");
    });

    it("when allowRaceConditions option is disabled updates are canceled", async () => {
      const context = getTestQuarkContext({
        configOptions: { allowRaceConditions: false },
      });
      const setStateMock = vitest.fn((v: string) => {
        context.value = v;
      });

      const controller = createUpdateController(context, setStateMock);

      const myPromise = Promise.resolve("foo");

      const p1Updater = controller.atomicUpdate();
      myPromise.then((v) => {
        p1Updater.update(v);
      });

      p1Updater.cancel();

      await sleep(0);

      expect(setStateMock).toHaveBeenCalledTimes(0);
      expect(context.value).toEqual("");
    });

    it("consecutive dispatches should cancel the previous updates", async () => {
      const context = getTestQuarkContext({
        configOptions: { allowRaceConditions: false },
      });
      const setStateMock = vitest.fn((v: string) => {
        context.value = v;
      });

      const controller = createUpdateController(context, setStateMock);

      const myPromise1 = Promise.resolve("foo");
      const myPromise2 = Promise.resolve("bar");
      const myPromise3 = Promise.resolve("baz");

      const p1Updater = controller.atomicUpdate();
      myPromise1.then((v) => {
        p1Updater.update(v);
      });

      const p2Updater = controller.atomicUpdate();
      myPromise2.then((v) => {
        p2Updater.update(v);
      });

      const p3Updater = controller.atomicUpdate();
      myPromise3.then((v) => {
        p3Updater.update(v);
      });

      await sleep(0);

      expect(setStateMock).toHaveBeenCalledTimes(1);
      expect(setStateMock).toHaveBeenLastCalledWith("baz");
      expect(context.value).toEqual("baz");
    });
  });
});
