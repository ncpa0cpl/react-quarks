import { asyncUpdatesController } from "../../../src/Utilities/StateUpdates/AsyncUpdates";
import { unpackStateSetter } from "../../../src/Utilities/StateUpdates/UnpackStateSetter";
import { getTestQuarkContext, sleep } from "../../helpers";

describe("unpackStateSetter", () => {
  const self = getTestQuarkContext({ value: "foo" });
  const asyncController = asyncUpdatesController(self);

  beforeAll(() => {
    jest.spyOn(asyncController, "preventLastAsyncUpdate");
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the passed value if it's not a generator or a promise", () => {
    expect.assertions(1);
    unpackStateSetter(self, asyncController, "bar").then((unpackedValue) => {
      expect(unpackedValue).toEqual("bar");
    });
  });

  it("should unpack a generator", () => {
    const generator = () => "bar";

    expect.assertions(1);
    unpackStateSetter(self, asyncController, generator).then(
      (unpackedValue) => {
        expect(unpackedValue).toEqual("bar");
      },
    );
  });

  it("should unpack a nested generator", () => {
    const generator = () => () => "bar";

    expect.assertions(1);
    unpackStateSetter(self, asyncController, generator).then(
      (unpackedValue) => {
        expect(unpackedValue).toEqual("bar");
      },
    );
  });

  it("should unpack a deeply nested generator", () => {
    const generator = () => () => () => () => "bar";

    expect.assertions(1);
    unpackStateSetter(self, asyncController, generator).then(
      (unpackedValue) => {
        expect(unpackedValue).toEqual("bar");
      },
    );
  });

  it("should unpack a promise", () => {
    const promise = Promise.resolve("baz");

    expect.assertions(1);
    unpackStateSetter(self, asyncController, promise).then((unpackedValue) => {
      expect(unpackedValue).toEqual("baz");
    });
  });

  it("should unpack a nested promise", () => {
    const promise = new Promise((resolve1) =>
      resolve1(new Promise((resolve2) => resolve2("baz"))),
    );

    expect.assertions(1);
    unpackStateSetter(self, asyncController, promise).then((unpackedValue) => {
      expect(unpackedValue).toEqual("baz");
    });
  });

  it("should unpack a deeply nested promise", () => {
    const promise = new Promise((resolve1) =>
      resolve1(
        new Promise((resolve2) =>
          resolve2(
            new Promise((resolve3) => {
              resolve3(new Promise((resolve4) => resolve4("baz")));
            }),
          ),
        ),
      ),
    );

    expect.assertions(1);
    unpackStateSetter(self, asyncController, promise).then((unpackedValue) => {
      expect(unpackedValue).toEqual("baz");
    });
  });

  it("should unpack a promise nested within generator", () => {
    const generator = () => Promise.resolve("qux");

    expect.assertions(1);
    unpackStateSetter(self, asyncController, generator).then(
      (unpackedValue) => {
        expect(unpackedValue).toEqual("qux");
      },
    );
  });

  it("should unpack a promise nested within generator (deeply)", () => {
    const generator = () => Promise.resolve(() => Promise.resolve("qux"));

    expect.assertions(1);
    unpackStateSetter(self, asyncController, generator).then(
      (unpackedValue) => {
        expect(unpackedValue).toEqual("qux");
      },
    );
  });

  it("should cancel the last async updates before executing 'then' handler", () => {
    expect.assertions(3);

    expect(asyncController.preventLastAsyncUpdate).toHaveBeenCalledTimes(0);

    unpackStateSetter(self, asyncController, "bar").then((unpackedValue) => {
      expect(unpackedValue).toEqual("bar");
      expect(asyncController.preventLastAsyncUpdate).toHaveBeenCalledTimes(1);
    });
  });

  it("should cancel the last async updates before executing then handler, but only after unpacking", async () => {
    const p = { resolve: () => {} };

    const promise = new Promise<void>((resolve) => {
      p.resolve = resolve;
    });

    const onThen = jest.fn();

    expect(asyncController.preventLastAsyncUpdate).toHaveBeenCalledTimes(0);

    unpackStateSetter(self, asyncController, promise).then((unpackedValue) => {
      onThen();
    });

    await sleep(1);

    expect(asyncController.preventLastAsyncUpdate).toHaveBeenCalledTimes(0);
    expect(onThen).toHaveBeenCalledTimes(0);

    p.resolve();

    await sleep(0);

    expect(asyncController.preventLastAsyncUpdate).toHaveBeenCalledTimes(1);
    expect(onThen).toHaveBeenCalledTimes(1);
  });
});
