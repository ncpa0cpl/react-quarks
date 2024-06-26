import { beforeEach, describe, expect, it, vitest } from "vitest";
import { createUpdateController } from "../../../src/Utilities/StateUpdates/AsyncUpdates";
import { unpackStateSetter } from "../../../src/Utilities/StateUpdates/UnpackStateSetter";
import { getTestQuarkContext, sleep } from "../../helpers";

describe("unpackStateSetter", () => {
  const self = getTestQuarkContext({ value: "foo" });
  const updateController = createUpdateController(self, () => {
    // do nothing
  });

  beforeEach(() => {
    vitest.clearAllMocks();
  });

  it("should return the passed value if it's not a generator or a promise", () => {
    expect.assertions(1);
    unpackStateSetter(self, updateController.atomicUpdate(), "bar").then(
      (unpackedValue) => {
        expect(unpackedValue).toEqual("bar");
      }
    );
  });

  it("should unpack a generator", () => {
    const generator = () => "bar";

    expect.assertions(1);
    unpackStateSetter(self, updateController.atomicUpdate(), generator).then(
      (unpackedValue) => {
        expect(unpackedValue).toEqual("bar");
      }
    );
  });

  it("should unpack a nested generator", () => {
    const generator = () => () => "bar";

    expect.assertions(1);
    unpackStateSetter(self, updateController.atomicUpdate(), generator).then(
      (unpackedValue) => {
        expect(unpackedValue).toEqual("bar");
      }
    );
  });

  it("should unpack a deeply nested generator", () => {
    const generator = () => () => () => () => "bar";

    expect.assertions(1);
    unpackStateSetter(self, updateController.atomicUpdate(), generator).then(
      (unpackedValue) => {
        expect(unpackedValue).toEqual("bar");
      }
    );
  });

  it("should unpack a promise", () => {
    const promise = Promise.resolve("baz");

    expect.assertions(1);
    unpackStateSetter(self, updateController.atomicUpdate(), promise).then(
      (unpackedValue) => {
        expect(unpackedValue).toEqual("baz");
      }
    );
  });

  it("should unpack a nested promise", async () => {
    const promise = new Promise((resolve1) =>
      resolve1(new Promise((resolve2) => resolve2("baz")))
    );

    expect.assertions(1);
    await unpackStateSetter(
      self,
      updateController.atomicUpdate(),
      promise
    ).then((unpackedValue) => {
      expect(unpackedValue).toEqual("baz");
    });
  });

  it("should unpack a deeply nested promise", async () => {
    const promise = new Promise((resolve1) =>
      resolve1(
        new Promise((resolve2) =>
          resolve2(
            new Promise((resolve3) => {
              resolve3(new Promise((resolve4) => resolve4("baz")));
            })
          )
        )
      )
    );

    expect.assertions(1);
    await unpackStateSetter(
      self,
      updateController.atomicUpdate(),
      promise
    ).then((unpackedValue) => {
      expect(unpackedValue).toEqual("baz");
    });
  });

  it("should unpack a promise nested within generator", () => {
    const generator = () => Promise.resolve("qux");

    expect.assertions(1);
    unpackStateSetter(self, updateController.atomicUpdate(), generator).then(
      (unpackedValue) => {
        expect(unpackedValue).toEqual("qux");
      }
    );
  });

  it("should unpack a promise nested within generator (deeply)", () => {
    const generator = () => Promise.resolve(() => Promise.resolve("qux"));

    expect.assertions(1);
    unpackStateSetter(self, updateController.atomicUpdate(), generator).then(
      (unpackedValue) => {
        expect(unpackedValue).toEqual("qux");
      }
    );
  });

  it("should cancel the last async updates before executing 'then' handler", () => {
    expect.assertions(1);

    unpackStateSetter(self, updateController.atomicUpdate(), "bar").then(
      (unpackedValue) => {
        expect(unpackedValue).toEqual("bar");
      }
    );
  });

  it("should cancel the last async updates before executing then handler, but only after unpacking", async () => {
    const p = { resolve: () => {} };

    const promise = new Promise<void>((resolve) => {
      p.resolve = resolve;
    });

    const onThen = vitest.fn();

    unpackStateSetter(self, updateController.atomicUpdate(), promise).then(
      (unpackedValue) => {
        onThen();
      }
    );

    await sleep(1);

    expect(onThen).toHaveBeenCalledTimes(0);

    p.resolve();

    await sleep(0);

    expect(onThen).toHaveBeenCalledTimes(1);
  });
});
