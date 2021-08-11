import { createDebugHistoryMiddleware, quark } from "../../../src";
import { StateUpdateHistory } from "../../../src/Middlewares/DebugHistoryMiddleware/UpdateHistory";
import { sleep } from "../../helpers";

declare const global: {
  __quark_history_tracker__: typeof StateUpdateHistory;
};

const getTime = (() =>
  (function* timeGenerator() {
    let start = 1600000000000;
    while (true) {
      yield start;
      start += 100;
    }
  })())();

jest.spyOn(Date, "now").mockImplementation(() => getTime.next().value);

describe("DebugHistoryMiddleware", () => {
  it("correctly saves updates to the history tracker", () => {
    const q = quark("FOO", {
      middlewares: [createDebugHistoryMiddleware({ name: "q1", trace: false })],
    });

    expect(q.get()).toEqual("FOO");

    q.set("BAR");

    expect(q.get()).toEqual("BAR");

    q.set("BAZ");

    expect(q.get()).toEqual("BAZ");

    expect(global.__quark_history_tracker__).toBeDefined();

    expect(global.__quark_history_tracker__.showHistory()).toMatchSnapshot();
  });

  it("correctly handles async updates", async () => {
    const q = quark("FOO", {
      middlewares: [createDebugHistoryMiddleware({ name: "q1", trace: false })],
    });

    expect(q.get()).toEqual("FOO");

    q.set(Promise.resolve("BAR"));

    q.set(Promise.resolve("BAZ"));

    await sleep(0);

    expect(global.__quark_history_tracker__.showHistory()).toMatchSnapshot();
  });
});
