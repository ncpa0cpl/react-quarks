import { DateTime } from "luxon";
import { createDebugHistoryMiddleware, quark } from "../../../src";
import { getStateUpdateHistory } from "../../../src/Middlewares/DebugHistoryMiddleware/UpdateHistory";
import { sleep } from "../../helpers";

declare const global: {
  __quark_history_tracker__: ReturnType<typeof getStateUpdateHistory>;
};

function* timeGenerator(): Generator<number, number, unknown> {
  let start = 1600000000000;
  while (true) {
    yield start;
    start += 100;
  }
}

let getTime = timeGenerator();

jest
  .spyOn(DateTime, "now")
  .mockImplementation(() => DateTime.fromMillis(getTime.next().value));

describe("DebugHistoryMiddleware", () => {
  let q = quark("FOO", {
    middlewares: [createDebugHistoryMiddleware({ name: "q1", trace: false })],
  });

  beforeEach(() => {
    getTime = timeGenerator();
    q.set("FOO");
    global?.__quark_history_tracker__?.clear();
  });

  it("correctly saves updates to the history tracker", () => {
    expect(q.get()).toEqual("FOO");

    q.set("BAR");

    expect(q.get()).toEqual("BAR");

    q.set(() => "BAZ");

    expect(q.get()).toEqual("BAZ");

    expect(global.__quark_history_tracker__).toBeDefined();

    expect(global.__quark_history_tracker__.showHistory()).toMatchSnapshot();
  });

  it("correctly handles async updates", async () => {
    expect(global.__quark_history_tracker__.showHistory()["0_q1"].length).toEqual(0);
    expect(q.get()).toEqual("FOO");

    q.set(Promise.resolve("BAR"));

    q.set(() => Promise.resolve("BAZ"));

    await sleep(0);

    expect(global.__quark_history_tracker__.showHistory()).toMatchSnapshot();
  });
});
