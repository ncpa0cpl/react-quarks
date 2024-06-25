import { act, renderHook } from "@testing-library/react-hooks";
import { beforeEach, describe, expect, it, vitest } from "vitest";
import { createCatchMiddleware, quark } from "../../../src";
import { sleep } from "../../helpers";

describe("CatchMiddleware", () => {
  const onCatchMock = vitest.fn();
  const catchMiddleware = createCatchMiddleware({ onCatch: onCatchMock });

  global.console.error = vitest.fn();

  beforeEach(() => {
    vitest.resetAllMocks();
  });

  describe("should resolve as usual when no errors are thrown", () => {
    describe("outside react", () => {
      it("set() correctly updates the state", async () => {
        const q = quark({ value: 0 }, { middlewares: [catchMiddleware] });

        expect(q.get()).toMatchObject({ value: 0 });

        q.set({ value: 6 });

        expect(q.get()).toMatchObject({ value: 6 });

        q.set((prev) => ({ value: prev.value * 2 }));

        expect(q.get()).toMatchObject({ value: 12 });

        const promise = Promise.resolve<{ value: number }>({ value: 999 });

        q.set(promise);

        await promise;
        await sleep(0);

        expect(q.get()).toMatchObject({ value: 999 });

        q.set(() => Promise.resolve({ value: 321 }));

        await sleep(0);

        expect(q.get()).toMatchObject({ value: 321 });

        expect(onCatchMock).toBeCalledTimes(0);
      });
      it("set() correctly handles asynchronous updates", async () => {
        const q = quark("A", { middlewares: [catchMiddleware] });

        const promiseA = new Promise<string>((resolve) => {
          setTimeout(() => {
            resolve("FOO");
          }, 20);
        });

        const promiseB = new Promise<string>((resolve) => {
          setTimeout(() => {
            resolve("BAR");
          }, 30);
        });

        q.set(promiseB);

        q.set(() => promiseA);

        expect(q.get()).toEqual("A");

        await promiseA;
        await sleep(0);

        expect(q.get()).toEqual("FOO");

        await promiseB;
        await sleep(0);

        expect(q.get()).toEqual("FOO");

        const promiseC = new Promise<string>((resolve) => {
          setTimeout(() => {
            resolve("BAZ");
          }, 20);
        });

        const promiseD = new Promise<string>((resolve) => {
          setTimeout(() => {
            resolve("QUX");
          }, 30);
        });

        q.set(() => promiseC);

        q.set(promiseD);

        q.set("CORGE");

        expect(q.get()).toEqual("CORGE");

        await promiseC;
        await sleep(0);

        expect(q.get()).toEqual("CORGE");

        await promiseD;
        await sleep(0);

        expect(q.get()).toEqual("CORGE");

        expect(onCatchMock).toBeCalledTimes(0);
      });
    });
    describe("within react", () => {
      it("use() and local set() work correctly for simple values", async () => {
        const q = quark({ value: 0 }, { middlewares: [catchMiddleware] });

        const state = renderHook(() => q.use());

        expect(state.result.current.value).toMatchObject({ value: 0 });

        act(() => {
          state.result.current.set({ value: 5 });
        });

        await state.waitFor(() =>
          expect(state.result.current.value).toMatchObject({ value: 5 })
        );

        expect(onCatchMock).toBeCalledTimes(0);
      });
      it("use() and local set() work correctly for a generator", async () => {
        const q = quark({ value: 1 }, { middlewares: [catchMiddleware] });

        const state = renderHook(() => q.use());

        expect(state.result.current.value).toMatchObject({ value: 1 });

        act(() => {
          state.result.current.set((v) => ({ value: v.value + 2 }));
        });

        await state.waitFor(() =>
          expect(state.result.current.value).toMatchObject({ value: 3 })
        );

        expect(onCatchMock).toBeCalledTimes(0);
      });
      it("use() and local set() work correctly for a promise", async () => {
        const q = quark({ value: 1 }, { middlewares: [catchMiddleware] });

        const state = renderHook(() => q.use());

        expect(state.result.current.value).toMatchObject({ value: 1 });

        await act(async () => {
          state.result.current.set(Promise.resolve({ value: 7 }));
          await sleep(0);
        });

        await state.waitFor(() =>
          expect(state.result.current.value).toMatchObject({ value: 7 })
        );

        expect(onCatchMock).toBeCalledTimes(0);
      });
      it("use() and local set() work correctly for a promise generator", async () => {
        const q = quark({ value: 1 }, { middlewares: [catchMiddleware] });

        const state = renderHook(() => q.use());

        expect(state.result.current.value).toMatchObject({ value: 1 });

        await act(async () => {
          state.result.current.set((v) =>
            Promise.resolve({ value: v.value + 2 })
          );
          await sleep(0);
        });

        await state.waitFor(() =>
          expect(state.result.current.value).toMatchObject({ value: 3 })
        );

        expect(onCatchMock).toBeCalledTimes(0);
      });
    });
  });

  describe("should fail when any errors are thrown without the middleware", () => {
    describe("outside react", () => {
      it("for generators", () => {
        const q = quark("");

        expect(onCatchMock).toBeCalledTimes(0);

        expect(() =>
          q.set(() => {
            throw "foo";
          })
        ).toThrow("foo");

        expect(onCatchMock).toBeCalledTimes(0);
      });
    });

    describe("within react", () => {
      it("for generators", async () => {
        const q = quark("");

        expect(onCatchMock).toBeCalledTimes(0);

        const result = renderHook(() => q.use());

        act(() => {
          expect(() =>
            result.result.current.set(() => {
              throw "foo";
            })
          ).toThrow("foo");
        });

        await sleep(10);

        expect(onCatchMock).toBeCalledTimes(0);
      });
    });
  });

  describe("should catch any errors thrown", () => {
    describe("outside react", () => {
      it("for generators", () => {
        const q = quark("", { middlewares: [catchMiddleware] });

        expect(onCatchMock).toBeCalledTimes(0);

        expect(() =>
          q.set(() => {
            throw "foo";
          })
        ).not.toThrow();

        expect(onCatchMock).toBeCalledTimes(1);
        expect(onCatchMock).toBeCalledWith("foo");
      });

      it("for promises", async () => {
        const q = quark("", { middlewares: [catchMiddleware] });

        expect(onCatchMock).toBeCalledTimes(0);

        await q.set(Promise.reject("bar"));

        expect(onCatchMock).toBeCalledTimes(1);
        expect(onCatchMock).toBeCalledWith("bar");
      });

      it("for promise generators", async () => {
        const q = quark("", { middlewares: [catchMiddleware] });

        expect(onCatchMock).toBeCalledTimes(0);

        await q.set(() => Promise.reject("bar"));

        expect(onCatchMock).toBeCalledTimes(1);
        expect(onCatchMock).toBeCalledWith("bar");
      });
    });
    describe("within react", () => {
      it("for generators", async () => {
        const q = quark("", { middlewares: [catchMiddleware] });

        expect(onCatchMock).toBeCalledTimes(0);

        const result = renderHook(() => q.use());

        act(() => {
          expect(() =>
            result.result.current.set(() => {
              throw "foo";
            })
          ).not.toThrow();
        });

        await sleep(10);

        expect(onCatchMock).toBeCalledTimes(1);
        expect(onCatchMock).toBeCalledWith("foo");
      });

      it("for promises", async () => {
        const q = quark("", { middlewares: [catchMiddleware] });

        expect(onCatchMock).toBeCalledTimes(0);

        await q.set(Promise.reject("bar"));

        expect(onCatchMock).toBeCalledTimes(1);
        expect(onCatchMock).toBeCalledWith("bar");
      });

      it("for promise generators", async () => {
        const q = quark("", { middlewares: [catchMiddleware] });

        expect(onCatchMock).toBeCalledTimes(0);

        await q.set(() => Promise.reject("bar"));

        expect(onCatchMock).toBeCalledTimes(1);
        expect(onCatchMock).toBeCalledWith("bar");
      });
    });
  });
});
