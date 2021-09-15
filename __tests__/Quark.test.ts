import { act, renderHook } from "@testing-library/react-hooks";
import type { QuarkMiddleware, QuarkSyncSetFn, QuarkType } from "../src";
import { quark } from "../src";
import {
  array,
  forAwait,
  rndBool,
  rndString,
  rndTResolve,
  sleep,
  testPromiseGenerator,
} from "./helpers";

describe("quark()", () => {
  describe("correctly works outside react", () => {
    it("set() correctly updates the state", async () => {
      const q = quark({ value: 0 });

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
    });
    it("set() correctly handles asynchronous updates", async () => {
      const q = quark("A");

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

      q.set(() => promiseB);

      q.set(promiseA);

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

      q.set(promiseC);

      q.set(() => promiseD);

      q.set("CORGE");

      expect(q.get()).toEqual("CORGE");

      await promiseC;
      await sleep(0);

      expect(q.get()).toEqual("CORGE");

      await promiseD;
      await sleep(0);

      expect(q.get()).toEqual("CORGE");
    });
    it("correctly executes custom actions", () => {
      const q = quark(
        { value: 0 },
        {
          actions: {
            increment(state) {
              return { value: state.value + 1 };
            },
            multiply(state, by: number) {
              return { value: state.value * by };
            },
          },
        }
      );

      expect(q.get()).toMatchObject({ value: 0 });

      q.increment();

      expect(q.get()).toMatchObject({ value: 1 });

      q.multiply(12);

      expect(q.get()).toMatchObject({ value: 12 });
    });
    describe("correctly handles middlewares", () => {
      it("middleware correctly intercepts the values set", () => {
        const mapMiddleware: QuarkMiddleware<any, 1 | 2> = (_, value, resume) => {
          if (typeof value === "number") {
            resume({ 1: "BAR", 2: "BAZ" }[value]);
          } else {
            resume(value);
          }
        };

        const q = quark("FOO", { middlewares: [mapMiddleware] });

        q.set(1);

        expect(q.get()).toEqual("BAR");

        q.set("QUX");

        expect(q.get()).toEqual("QUX");
      });
      it("resume() correctly pipes results from one middleware to the next", () => {
        const multiplyMiddleware: QuarkMiddleware<number, number> = (
          _,
          value,
          resume
        ) => {
          if (typeof value === "number") resume(value * 2);
          else resume(value);
        };
        const subtractMiddleware: QuarkMiddleware<number, number> = (
          _,
          value,
          resume
        ) => {
          if (typeof value === "number") resume(value - 1);
          else resume(value);
        };
        const squareMiddleware: QuarkMiddleware<number, number> = (
          _,
          value,
          resume
        ) => {
          if (typeof value === "number") resume(value ** 2);
          else resume(value);
        };

        const q = quark(0, {
          middlewares: [multiplyMiddleware, subtractMiddleware, squareMiddleware],
        });

        q.set(2);

        expect(q.get()).toEqual((2 * 2 - 1) ** 2);
      });
      it("set() correctly omits following middlewares", () => {
        const firstMiddleware: QuarkMiddleware<any, number> = (
          state,
          value,
          resume,
          set
        ) => {
          if (typeof value === "number") return set(`${value}`);
          return resume(value);
        };
        const secondMiddleware: QuarkMiddleware<any, undefined> = jest.fn(
          (state, value, resume, set) => {
            resume(undefined);
          }
        );

        const q = quark("FOO", { middlewares: [firstMiddleware, secondMiddleware] });

        q.set(2);

        expect(q.get()).toEqual("2");
        expect(secondMiddleware).toBeCalledTimes(0);
      });
    });
    describe("correctly executes side effect", () => {
      type Q = {
        value: number;
        derivedValue: string;
      };

      const increment = (state: Q) => {
        return { ...state, value: state.value + 1 };
      };

      const setDerivedValue = (state: Q, newDerivedValue: string) => {
        return { ...state, derivedValue: newDerivedValue };
      };

      const deriveValue = (
        prevState: Q,
        newState: Q,
        set: QuarkSyncSetFn<Q, never>
      ) => {
        if (prevState.value !== newState.value) {
          set((v) => setDerivedValue(v, `${newState.value}`));
        }
      };

      it("when set() is called", () => {
        const q = quark(
          { value: 0, derivedValue: "0" },
          {
            actions: {
              increment,
              setDerivedValue,
            },
            effect: deriveValue,
          }
        );

        expect(q.get()).toMatchObject({ value: 0, derivedValue: "0" });

        q.set((s) => ({ ...s, value: 76 }));

        expect(q.get()).toMatchObject({ value: 76, derivedValue: "76" });
      });
      it("when custom action is called", () => {
        const q = quark(
          { value: 0, derivedValue: "0" },
          {
            actions: {
              increment,
              setDerivedValue,
            },
            effect: deriveValue,
          }
        );

        expect(q.get()).toMatchObject({ value: 0, derivedValue: "0" });

        q.increment();

        expect(q.get()).toMatchObject({ value: 1, derivedValue: "1" });
      });
      it("with nested effects", () => {
        type Q = {
          value: number;
          derivedValue1: string;
          derivedValue2: string;
          derivedValue3: string;
        };

        const increment = (state: Q) => {
          return { ...state, value: state.value + 1 };
        };

        const deriveValue = (
          prevState: Q,
          newState: Q,
          set: QuarkSyncSetFn<Q, never>
        ) => {
          if (prevState.value !== newState.value) {
            set((v) => ({ ...v, derivedValue1: `${v.value}` }));
          } else if (prevState.derivedValue1 !== newState.derivedValue1) {
            set((v) => ({
              ...v,
              derivedValue2: `${v.derivedValue1}-${v.derivedValue1}`,
            }));
          } else if (prevState.derivedValue2 !== newState.derivedValue2) {
            set((v) => ({
              ...v,
              derivedValue3: `${v.derivedValue2}-${v.derivedValue2}`,
            }));
          }
        };

        const q = quark(
          {
            value: 0,
            derivedValue1: "0",
            derivedValue2: "0-0",
            derivedValue3: "0-0-0-0",
          },
          {
            actions: {
              increment,
            },
            effect: deriveValue,
          }
        );

        expect(q.get()).toMatchObject({
          value: 0,
          derivedValue1: "0",
          derivedValue2: "0-0",
          derivedValue3: "0-0-0-0",
        });

        q.set((s) => ({ ...s, value: 15 }));

        expect(q.get()).toMatchObject({
          value: 15,
          derivedValue1: "15",
          derivedValue2: "15-15",
          derivedValue3: "15-15-15-15",
        });
      });
    });
    describe("correctly handles manual subscriptions", () => {
      it("correctly calls the callback with the current state", async () => {
        const q = quark("foo");

        const onSubOne = jest.fn();
        const onSubTwo = jest.fn();

        q.subscribe((state) => {
          onSubOne(state);
        });

        q.subscribe((state) => {
          onSubTwo(state);
        });

        q.set("bar");

        expect(onSubOne).toHaveBeenCalledTimes(0);
        expect(onSubTwo).toHaveBeenCalledTimes(0);

        await sleep(0);

        expect(onSubOne).toHaveBeenCalledTimes(1);
        expect(onSubTwo).toHaveBeenCalledTimes(1);

        expect(onSubOne).toHaveBeenCalledWith("bar");
        expect(onSubTwo).toHaveBeenCalledWith("bar");
      });

      it("correctly cancels the subscription", async () => {
        const q = quark("foo");

        const onSubOne = jest.fn();
        const onSubTwo = jest.fn();

        const subOne = q.subscribe((state) => {
          onSubOne(state);
        });

        q.subscribe((state, cancel) => {
          onSubTwo(state);
          cancel();
        });

        subOne.cancel();

        q.set("bar");

        await sleep(0);

        expect(onSubOne).toHaveBeenCalledTimes(0);
        expect(onSubTwo).toHaveBeenCalledTimes(1);

        q.set("baz");

        await sleep(0);

        expect(onSubOne).toHaveBeenCalledTimes(0);
        expect(onSubTwo).toHaveBeenCalledTimes(1);
      });

      it("correctly propagates subscription cancelled after update", async () => {
        const q = quark("foo");

        const onSubOne = jest.fn();
        const onSubTwo = jest.fn();

        const subOne = q.subscribe((state) => {
          onSubOne(state);
        });

        q.subscribe((state, cancel) => {
          onSubTwo(state);
        });

        q.set("bar");

        subOne.cancel();

        await sleep(0);

        expect(onSubOne).toHaveBeenCalledTimes(1);
        expect(onSubTwo).toHaveBeenCalledTimes(1);

        q.set("baz");

        await sleep(0);

        expect(onSubOne).toHaveBeenCalledTimes(1);
        expect(onSubTwo).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("correctly works in react context", () => {
    it("use() and local set() work correctly", () => {
      const q = quark({ value: 0 });

      const state = renderHook(() => q.use());

      expect(state.result.current.get()).toMatchObject({ value: 0 });

      act(() => {
        state.result.current.set({ value: 5 });
      });

      expect(state.result.current.get()).toMatchObject({ value: 5 });
    });
    it("use() and local set() work correctly for async updates", async () => {
      const q = quark({ value: 0 });

      const state = renderHook(() => q.use());

      expect(state.result.current.get()).toMatchObject({ value: 0 });

      await act(async () => {
        state.result.current.set(() => Promise.resolve({ value: 5 }));
        await sleep(0);
      });

      expect(state.result.current.get()).toMatchObject({ value: 5 });
    });
    it("use() correctly exposes custom actions", () => {
      const q = quark(
        { value: 0 },
        { actions: { increment: (s) => ({ value: s.value + 1 }) } }
      );

      const state = renderHook(() => q.use());

      expect(state.result.current.get()).toMatchObject({ value: 0 });

      act(() => {
        state.result.current.increment();
      });

      expect(state.result.current.get()).toMatchObject({ value: 1 });
    });
    it("use() correctly exposes custom selectors with parameters", () => {
      const q = quark(["a", "b", "c", "d"], {
        selectors: {
          useIndex(s, index: number) {
            return s[index];
          },
        },
      });

      const state = renderHook(
        (props) => {
          return q.useIndex(props.index);
        },
        {
          initialProps: { index: 2 },
        }
      );

      expect(state.result.current.get()).toEqual("c");

      state.rerender({ index: 0 });

      expect(state.result.current.get()).toEqual("a");
    });
    it("use() correctly exposes custom actions with async updates", async () => {
      const q = quark(
        { value: 0 },
        {
          actions: {
            incrementAsync: (s) => Promise.resolve({ value: s.value + 1 }),
          },
        }
      );

      const state = renderHook(() => q.use());

      expect(state.result.current.get()).toMatchObject({ value: 0 });

      await act(async () => {
        state.result.current.incrementAsync();
        await sleep(0);
      });

      expect(state.result.current.get()).toMatchObject({ value: 1 });
    });
    it("use() correctly triggers custom effects when local set is called", () => {
      const q = quark(
        { value: 0 },
        {
          actions: { increment: (s) => ({ value: s.value + 1 }) },
          effect: (_, curr, set) => {
            if (curr.value % 2 !== 0) {
              set({ value: curr.value + 1 });
            }
          },
        }
      );

      const state = renderHook(() => q.use());

      expect(state.result.current.get()).toMatchObject({ value: 0 });

      act(() => {
        state.result.current.set({ value: 1 });
      });

      expect(state.result.current.get()).toMatchObject({ value: 2 });
    });
    it("use() correctly triggers custom effects when global set is called", () => {
      const q = quark(
        { value: 0 },
        {
          actions: { increment: (s) => ({ value: s.value + 1 }) },
          effect: (_, curr, set) => {
            if (curr.value % 2 !== 0) {
              set({ value: curr.value + 1 });
            }
          },
        }
      );

      const state = renderHook(() => q.use());

      expect(state.result.current.get()).toMatchObject({ value: 0 });

      act(() => {
        q.set({ value: 1 });
      });

      expect(state.result.current.get()).toMatchObject({ value: 2 });
    });
    it("use() correctly triggers custom effects when local custom action is called", () => {
      const q = quark(
        { value: 0 },
        {
          actions: { increment: (s) => ({ value: s.value + 1 }) },
          effect: (_, curr, set) => {
            if (curr.value % 2 !== 0) {
              set({ value: curr.value + 1 });
            }
          },
        }
      );

      const state = renderHook(() => q.use());

      expect(state.result.current.get()).toMatchObject({ value: 0 });

      act(() => {
        state.result.current.increment();
      });

      expect(state.result.current.get()).toMatchObject({ value: 2 });
    });
    it("use() correctly triggers custom effects when global custom action is called", () => {
      const q = quark(
        { value: 0 },
        {
          actions: { increment: (s) => ({ value: s.value + 1 }) },
          effect: (_, curr, set) => {
            if (curr.value % 2 !== 0) {
              set({ value: curr.value + 1 });
            }
          },
        }
      );

      const state = renderHook(() => q.use());

      expect(state.result.current.get()).toMatchObject({ value: 0 });

      act(() => {
        q.increment();
      });

      expect(state.result.current.get()).toMatchObject({ value: 2 });
    });
    it("use() correctly rerenders when an effect dispatches a Promise", async () => {
      const q = quark(
        { value: 0, derivedValue: "0" },
        {
          actions: { increment: (s) => ({ ...s, value: s.value + 1 }) },
          effect: (prev, current, set) => {
            if (prev.value !== current.value) {
              set(() =>
                sleep(10).then((): { value: number; derivedValue: string } => ({
                  ...current,
                  derivedValue: `${current.value}`,
                }))
              );
            }
          },
        }
      );

      const state = renderHook(() => q.use());

      expect(state.result.current.get()).toMatchObject({
        value: 0,
        derivedValue: "0",
      });

      await act(async () => {
        state.result.current.increment();
        await sleep(12);
      });

      const currentQ = state.result.current.get();

      expect(currentQ).toMatchObject({
        value: 1,
        derivedValue: "1",
      });
    });
    it("useSelector() correctly avoids unnecessary re-renders", async () => {
      const q = quark({ value1: 0, value2: 100 });
      const reRenderCounter = jest.fn();

      const selectV1 = (a: QuarkType<typeof q>) => a.value1;

      const state = renderHook(() => {
        reRenderCounter();
        return q.useSelector(selectV1);
      });

      expect(q.get().value2).toEqual(100);
      expect(state.result.current.get()).toEqual(0);
      expect(reRenderCounter).toHaveBeenCalledTimes(1);

      await act(async () => {
        q.set((s) => ({ ...s, value1: 5 }));

        await sleep(0);
      });

      expect(q.get().value2).toEqual(100);
      expect(state.result.current.get()).toEqual(5);
      expect(reRenderCounter).toHaveBeenCalledTimes(2);

      await act(async () => {
        q.set((s) => ({ ...s, value2: 99 }));

        await sleep(0);
      });

      expect(q.get().value2).toEqual(99);
      expect(state.result.current.get()).toEqual(5);
      expect(reRenderCounter).toHaveBeenCalledTimes(2);
    });
    it("custom selectors correctly avoid unnecessary re-renders", async () => {
      const q = quark(
        { value1: 1, value2: 321 },
        {
          actions: {
            SetVal1: (s, v: number) => ({ ...s, value1: v }),
            SetVal2: (s, v: number) => ({ ...s, value2: v }),
          },
          selectors: {
            useValue1: (s) => s.value1,
          },
        }
      );
      const reRenderCounter = jest.fn();

      const state = renderHook(() => {
        reRenderCounter();
        return q.useValue1();
      });

      expect(q.get().value2).toEqual(321);
      expect(state.result.current.get()).toEqual(1);
      expect(reRenderCounter).toHaveBeenCalledTimes(1);

      await act(async () => {
        q.SetVal1(15);
        await sleep(0);
      });

      expect(q.get().value2).toEqual(321);
      expect(state.result.current.get()).toEqual(15);
      expect(reRenderCounter).toHaveBeenCalledTimes(2);

      await act(async () => {
        q.SetVal2(55);
        await sleep(0);
      });

      expect(q.get().value2).toEqual(55);
      expect(state.result.current.get()).toEqual(15);
      expect(reRenderCounter).toHaveBeenCalledTimes(2);
    });
  });

  describe("async updates correctly avoid race conditions", () => {
    describe("for raw Promises", () => {
      describe("for a async final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" });

          const setSpy = jest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = testPromiseGenerator();

          for (const _ in array(batchSize)) {
            q.set(promises.generate(() => rndTResolve({ value: rndString() })));
          }

          q.set(promises.generate(() => rndTResolve(expectedResult)));

          await promises.waitForAll();

          expect(setSpy).toBeCalledTimes(batchSize + 1);
          expect(q.get()).toMatchObject(expectedResult);
        }

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(2));
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(4));
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(8));
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(16));
        });

        it("(batch size of 24)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(24));
        });

        it("(batch size of 64)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(64));
        });

        it("(batch size of 128)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(128));
        });

        it("(batch size of 256)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(256));
        });

        it("(batch size of 512)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(512));
        });

        it("(batch size of 1024)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(1024));
        });
      });
      describe("for a sync final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" });

          const setSpy = jest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = testPromiseGenerator();

          for (const _ in array(batchSize)) {
            q.set(promises.generate(() => rndTResolve({ value: rndString() })));
          }

          q.set(expectedResult);

          await promises.waitForAll();

          expect(setSpy).toBeCalledTimes(batchSize + 1);
          expect(q.get()).toMatchObject(expectedResult);
        }

        it("(batch size of 1)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(1));
        });

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(2));
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(4));
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(8));
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(16));
        });
      });
      describe("for a async generator final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" });

          const setSpy = jest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = testPromiseGenerator();

          for (const _ in array(batchSize)) {
            q.set(promises.generate(() => rndTResolve({ value: rndString() })));
          }

          q.set(() => promises.generate(() => rndTResolve(expectedResult)));

          await promises.waitForAll();

          expect(setSpy).toBeCalledTimes(batchSize + 1);
          expect(q.get()).toMatchObject(expectedResult);
        }

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(2));
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(4));
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(8));
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(16));
        });

        it("(batch size of 24)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(24));
        });

        it("(batch size of 64)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(64));
        });

        it("(batch size of 128)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(128));
        });

        it("(batch size of 256)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(256));
        });

        it("(batch size of 512)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(512));
        });

        it("(batch size of 1024)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(1024));
        });
      });
      describe("for a sync generator final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" });

          const setSpy = jest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = testPromiseGenerator();

          for (const _ in array(batchSize)) {
            q.set(promises.generate(() => rndTResolve({ value: rndString() })));
          }

          q.set(() => expectedResult);

          await promises.waitForAll();

          expect(setSpy).toBeCalledTimes(batchSize + 1);
          expect(q.get()).toMatchObject(expectedResult);
        }

        it("(batch size of 1)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(1));
        });

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(2));
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(4));
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(8));
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(16));
        });
      });
    });

    describe("for Promise generators", () => {
      describe("for a async final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" });

          const setSpy = jest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = testPromiseGenerator();

          for (const _ in array(batchSize)) {
            q.set(() =>
              promises.generate(() => rndTResolve({ value: rndString() }))
            );
          }

          q.set(promises.generate(() => rndTResolve(expectedResult)));

          await promises.waitForAll();

          expect(setSpy).toBeCalledTimes(batchSize + 1);
          expect(q.get()).toMatchObject(expectedResult);
        }

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(2));
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(4));
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(8));
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(16));
        });

        it("(batch size of 24)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(24));
        });

        it("(batch size of 64)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(64));
        });

        it("(batch size of 128)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(128));
        });

        it("(batch size of 256)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(256));
        });

        it("(batch size of 512)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(512));
        });

        it("(batch size of 1024)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(1024));
        });
      });
      describe("for a sync final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" });

          const setSpy = jest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = testPromiseGenerator();

          for (const _ in array(batchSize)) {
            q.set(() =>
              promises.generate(() => rndTResolve({ value: rndString() }))
            );
          }

          q.set(expectedResult);

          await promises.waitForAll();

          expect(setSpy).toBeCalledTimes(batchSize + 1);
          expect(q.get()).toMatchObject(expectedResult);
        }

        it("(batch size of 1)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(1));
        });

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(2));
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(4));
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(8));
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(16));
        });
      });
      describe("for a async generator final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" });

          const setSpy = jest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = testPromiseGenerator();

          for (const _ in array(batchSize)) {
            q.set(() =>
              promises.generate(() => rndTResolve({ value: rndString() }))
            );
          }

          q.set(() => promises.generate(() => rndTResolve(expectedResult)));

          await promises.waitForAll();

          expect(setSpy).toBeCalledTimes(batchSize + 1);
          expect(q.get()).toMatchObject(expectedResult);
        }

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(2));
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(4));
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(8));
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(16));
        });

        it("(batch size of 24)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(24));
        });

        it("(batch size of 64)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(64));
        });

        it("(batch size of 128)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(128));
        });

        it("(batch size of 256)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(256));
        });

        it("(batch size of 512)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(512));
        });

        it("(batch size of 1024)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(1024));
        });
      });
      describe("for a sync generator final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" });

          const setSpy = jest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = testPromiseGenerator();

          for (const _ in array(batchSize)) {
            q.set(() =>
              promises.generate(() => rndTResolve({ value: rndString() }))
            );
          }

          q.set(() => expectedResult);

          await promises.waitForAll();

          expect(setSpy).toBeCalledTimes(batchSize + 1);
          expect(q.get()).toMatchObject(expectedResult);
        }

        it("(batch size of 1)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(1));
        });

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(2));
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(4));
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(8));
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(16));
        });
      });
    });

    describe("for raw Promises and Promise generators together", () => {
      describe("for a async final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" });

          const setSpy = jest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = testPromiseGenerator();

          for (const _ in array(batchSize)) {
            if (rndBool()) {
              q.set(promises.generate(() => rndTResolve({ value: rndString() })));
            } else {
              q.set(() =>
                promises.generate(() => rndTResolve({ value: rndString() }))
              );
            }
          }

          if (rndBool()) q.set(promises.generate(() => rndTResolve(expectedResult)));
          else q.set(() => promises.generate(() => rndTResolve(expectedResult)));

          await promises.waitForAll();

          expect(setSpy).toBeCalledTimes(batchSize + 1);
          expect(q.get()).toMatchObject(expectedResult);
        }

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(2));
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(4));
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(8));
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(16));
        });

        it("(batch size of 24)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(24));
        });

        it("(batch size of 64)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(64));
        });

        it("(batch size of 128)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(128));
        });

        it("(batch size of 256)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(256));
        });

        it("(batch size of 512)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(512));
        });

        it("(batch size of 1024)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(1024));
        });
      });
      describe("for a sync generator final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" });

          const setSpy = jest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = testPromiseGenerator();

          for (const _ in array(batchSize)) {
            if (rndBool())
              q.set(promises.generate(() => rndTResolve({ value: rndString() })));
            else
              q.set(() =>
                promises.generate(() => rndTResolve({ value: rndString() }))
              );
          }

          if (rndBool()) q.set(expectedResult);
          else q.set(() => expectedResult);

          await promises.waitForAll();

          expect(setSpy).toBeCalledTimes(batchSize + 1);
          expect(q.get()).toMatchObject(expectedResult);
        }

        it("(batch size of 1)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(1));
        });

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(2));
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(4));
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(8));
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () => runTestWithRandomPromiseResolveTime(16));
        });
      });
    });
  });
});
