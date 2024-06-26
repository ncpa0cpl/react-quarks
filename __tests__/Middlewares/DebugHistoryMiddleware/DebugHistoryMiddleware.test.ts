import { DateTime } from "luxon";
import { beforeEach, describe, expect, it, vitest } from "vitest";
import { createDebugHistoryMiddleware, quark } from "../../../src";
import { getStateUpdateHistory } from "../../../src/Middlewares/DebugHistoryMiddleware/UpdateHistory";
import { sleep } from "../../helpers";

declare module "luxon" {
  interface TSSettings {
    throwOnInvalid: true;
  }
}

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

vitest
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
    expect(
      global.__quark_history_tracker__.showHistory()["0_q1"].length
    ).toEqual(0);
    expect(q.get()).toEqual("FOO");

    q.set(Promise.resolve("BAR"));

    q.set(() => Promise.resolve("BAZ"));

    await sleep(0);

    expect(global.__quark_history_tracker__.showHistory()).toMatchSnapshot();
  });

  it("correctly handles procedures", async () => {
    const q = quark(
      { value: undefined as string | undefined, loading: false },
      {
        middlewares: [
          createDebugHistoryMiddleware({ name: "q2", trace: false }),
        ],
        procedures: {
          async *start() {
            yield (c) => ({ ...c, loading: true });
            yield (c) => ({ ...c, value: "foo" });
            return { value: "bar", loading: false };
          },
        },
      }
    );

    expect(q.get()).toEqual({ value: undefined, loading: false });
    expect(
      global.__quark_history_tracker__.showHistory()["1_q2"].length
    ).toEqual(1);

    await q.start();

    expect(q.get()).toEqual({ value: "bar", loading: false });
    expect(
      global.__quark_history_tracker__.showHistory()["1_q2"].length
    ).toEqual(7);
    expect(global.__quark_history_tracker__.showHistory()).toMatchSnapshot();
  });
});
