import { act, renderHook } from "@testing-library/react-hooks";
import { describe, expect, it, vitest } from "vitest";
import type { QuarkMiddleware, QuarkSetterFn, QuarkType } from "../src";
import { createImmerMiddleware, quark } from "../src";
import {
  array,
  controlledPromise,
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

      await q.set(promise);

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

      const setterBPromise = q.set(() => promiseB);

      const setterAPromise = q.set(promiseA);

      expect(q.get()).toEqual("A");

      await setterAPromise;

      expect(q.get()).toEqual("FOO");

      await setterBPromise;

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

      const setterCPromise = q.set(promiseC);

      const setterDPromise = q.set(() => promiseD);

      q.set("CORGE");

      expect(q.get()).toEqual("CORGE");

      await setterCPromise;

      expect(q.get()).toEqual("CORGE");

      await setterDPromise;

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
        const mapMiddleware: QuarkMiddleware<any, 1 | 2> = ({
          resume,
          action,
          updateType,
        }) => {
          if (updateType !== "async-generator" && typeof action === "number") {
            resume({ 1: "BAR", 2: "BAZ" }[action]);
          } else {
            resume(action);
          }
        };

        const q = quark("FOO", { middlewares: [mapMiddleware] });

        q.set(1);

        expect(q.get()).toEqual("BAR");

        q.set("QUX");

        expect(q.get()).toEqual("QUX");
      });
      it("resume() correctly pipes results from one middleware to the next", () => {
        const multiplyMiddleware: QuarkMiddleware<any, number> = ({
          action,
          resume,
          updateType,
        }) => {
          if (updateType !== "async-generator" && typeof action === "number") {
            return resume(action * 2);
          }
          resume(action);
        };
        const subtractMiddleware: QuarkMiddleware<any, number> = ({
          action,
          resume,
          updateType,
        }) => {
          if (updateType !== "async-generator" && typeof action === "number")
            resume(action - 1);
          else resume(action);
        };
        const squareMiddleware: QuarkMiddleware<any, number> = ({
          action,
          resume,
          updateType,
        }) => {
          if (updateType !== "async-generator" && typeof action === "number")
            resume(action ** 2);
          else resume(action);
        };

        const q = quark(0, {
          middlewares: [
            multiplyMiddleware,
            subtractMiddleware,
            squareMiddleware,
          ],
        });

        q.set(2);

        expect(q.get()).toEqual((2 * 2 - 1) ** 2);
      });

      it("set() correctly omits following middlewares", () => {
        const firstMiddleware = vitest.fn(({ action, set, resume }) => {
          if (typeof action === "number") return set(`${action}`);
          return resume(action);
        }) satisfies QuarkMiddleware<any, number>;

        const secondMiddleware = vitest.fn(({ resume, action }) => {
          resume(action);
        }) satisfies QuarkMiddleware<any, undefined>;

        const q = quark("FOO", {
          middlewares: [firstMiddleware, secondMiddleware],
        });

        expect(firstMiddleware).toBeCalledTimes(1);
        expect(secondMiddleware).toBeCalledTimes(1);
        secondMiddleware.mockClear();
        firstMiddleware.mockClear();

        q.set(2);

        expect(q.get()).toEqual("2");
        expect(firstMiddleware).toBeCalledTimes(1);
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
        set: QuarkSetterFn<Q, never>
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
          set: QuarkSetterFn<Q, never>
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

        const onSubOne = vitest.fn();
        const onSubTwo = vitest.fn();

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

        const onSubOne = vitest.fn();
        const onSubTwo = vitest.fn();

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

      it("does not notify subscriptions that were cancelled after update", async () => {
        const q = quark("foo");

        const onSubOne = vitest.fn();
        const onSubTwo = vitest.fn();

        const subOne = q.subscribe((state) => {
          onSubOne(state);
        });

        q.subscribe((state, cancel) => {
          onSubTwo(state);
        });

        q.set("bar");

        subOne.cancel();

        expect(onSubOne).toHaveBeenCalledTimes(0);
        expect(onSubTwo).toHaveBeenCalledTimes(0);

        await sleep(0);

        expect(onSubOne).toHaveBeenCalledTimes(0);
        expect(onSubTwo).toHaveBeenCalledTimes(1);

        q.set("baz");

        await sleep(0);

        expect(onSubOne).toHaveBeenCalledTimes(0);
        expect(onSubTwo).toHaveBeenCalledTimes(2);
      });
    });
    describe("custom selectors", () => {
      it("returns the selected value", () => {
        const q = quark(
          { value1: 5, value2: 321 },
          {
            actions: {
              SetVal1: (s, v: number) => ({ ...s, value1: v }),
              SetVal2: (s, v: number) => ({ ...s, value2: v }),
            },
            selectors: {
              value1: (s) => s.value1,
              value2: (s) => s.value2,
              valueSum: (s) => s.value1 + s.value2,
            },
          }
        );

        expect(q.selectValue1()).toEqual(5);
        expect(q.selectValue2()).toEqual(321);
        expect(q.selectValueSum()).toEqual(326);

        q.SetVal1(10);

        expect(q.selectValue1()).toEqual(10);
        expect(q.selectValueSum()).toEqual(331);
      });
      it("correctly handle arguments", () => {
        const q = quark(
          { value1: 5, value2: 321 },
          {
            actions: {
              SetVal1: (s, v: number) => ({ ...s, value1: v }),
              SetVal2: (s, v: number) => ({ ...s, value2: v }),
            },
            selectors: {
              v: (s, n: 1 | 2) => s[`value${n}`],
              multipliedBy: (s, n: number) => s.value1 * n,
            },
          }
        );

        expect(q.selectV(1)).toEqual(5);
        expect(q.selectV(2)).toEqual(321);
        expect(q.selectMultipliedBy(12)).toEqual(60);

        q.SetVal1(69);

        expect(q.selectV(1)).toEqual(69);
        expect(q.selectMultipliedBy(10)).toEqual(690);
      });
    });
    describe("procedures", () => {
      it("correctly update the state with yielded values", async () => {
        const p = controlledPromise<{ value: number }>();

        const q = quark(
          { inProgress: false, value: 2 },
          {
            procedures: {
              async *runProcedure(initState) {
                yield { ...initState, inProgress: true };
                const newValue = await p.promise;
                return { inProgress: false, value: newValue.value };
              },
            },
          }
        );

        q.runProcedure();

        await sleep(0);

        expect(q.get()).toMatchObject({ inProgress: true, value: 2 });

        p.resolve({ value: 5 });

        await sleep(0);

        expect(q.get()).toMatchObject({ inProgress: false, value: 5 });
      });
      it("correctly update the state with yielded fn setters", async () => {
        const p = controlledPromise<{ value: number }>();

        const q = quark(
          { inProgress: false, value: 2 },
          {
            procedures: {
              async *runProcedure() {
                yield (current) => ({ ...current, inProgress: true });
                const newValue = await p.promise;
                return () => ({ inProgress: false, value: newValue.value });
              },
            },
          }
        );

        q.runProcedure();

        await sleep(0);

        expect(q.get()).toMatchObject({ inProgress: true, value: 2 });

        p.resolve({ value: 5 });

        await sleep(0);

        expect(q.get()).toMatchObject({ inProgress: false, value: 5 });
      });
      it("correctly update the state with yielded fn setters and immer", async () => {
        const p = controlledPromise<{ value: number }>();

        const q = quark(
          { inProgress: false, value: 20 },
          {
            middlewares: [createImmerMiddleware()],
            procedures: {
              async *runProcedure() {
                yield (draft) => {
                  draft.inProgress = true;
                  return draft;
                };
                const newValue = await p.promise;
                return (draft) => {
                  draft.inProgress = false;
                  draft.value = newValue.value;
                  return draft;
                };
              },
            },
          }
        );

        q.runProcedure();

        await sleep(0);

        expect(q.get()).toMatchObject({ inProgress: true, value: 20 });

        p.resolve({ value: 1234 });

        await sleep(0);

        expect(q.get()).toMatchObject({ inProgress: false, value: 1234 });
      });
      it("interrupts a procedure if another state update happens", async () => {
        const p1 = controlledPromise<{ value: number }>();
        const p2 = controlledPromise<{ value: number }>();

        const q = quark(
          { inProgress: false, value: 2 },
          {
            procedures: {
              async *runProcedure() {
                yield { inProgress: true, value: 0 };
                const newValue = await p1.promise;
                yield { inProgress: true, value: newValue.value };
                const newValue2 = await p2.promise;
                return { inProgress: false, value: newValue2.value };
              },
            },
          }
        );

        q.runProcedure();
        await sleep(0);
        expect(q.get()).toMatchObject({ inProgress: true, value: 0 });

        p1.resolve({ value: 10 });
        await sleep(0);
        expect(q.get()).toMatchObject({ inProgress: true, value: 10 });

        q.set({ inProgress: false, value: 15 });

        expect(q.get()).toMatchObject({ inProgress: false, value: 15 });

        p2.resolve({ value: 20 });
        await sleep(0);
        expect(q.get()).toMatchObject({ inProgress: false, value: 15 });
      });
      it("interrupts a procedure if an async state update happens", async () => {
        const p1 = controlledPromise<{ value: number }>();
        const p2 = controlledPromise<{ value: number }>();

        const q = quark(
          { inProgress: false, value: 2 },
          {
            procedures: {
              async *runProcedure() {
                yield { inProgress: true, value: 0 };
                const newValue = await p1.promise;
                yield { inProgress: true, value: newValue.value };
                const newValue2 = await p2.promise;
                return { inProgress: false, value: newValue2.value };
              },
            },
            actions: {
              async fetchValue(s) {
                await sleep(0);
                return { value: 100, inProgress: false };
              },
            },
          }
        );

        q.runProcedure();
        await sleep(0);
        expect(q.get()).toMatchObject({ inProgress: true, value: 0 });

        await q.fetchValue();
        expect(q.get()).toMatchObject({ inProgress: false, value: 100 });

        p1.resolve({ value: 10 });
        await sleep(0);
        expect(q.get()).toMatchObject({ inProgress: false, value: 100 });

        p2.resolve({ value: 20 });
        await sleep(0);
        expect(q.get()).toMatchObject({ inProgress: false, value: 100 });
      });
    });
  });

  describe("correctly works with react", () => {
    it("use() and local set() work correctly", async () => {
      const q = quark({ value: 0 });

      const state = renderHook(() => q.use());

      expect(state.result.current.value).toMatchObject({ value: 0 });

      act(() => {
        state.result.current.set({ value: 5 });
      });

      await state.waitFor(() =>
        expect(state.result.current.value).toMatchObject({ value: 5 })
      );
    });
    it("use() and local set() work correctly for async updates", async () => {
      const q = quark({ value: 0 });

      const state = renderHook(() => q.use());

      expect(state.result.current.value).toMatchObject({ value: 0 });

      await act(async () => {
        await state.result.current.set(() => Promise.resolve({ value: 5 }));
      });

      await state.waitFor(() =>
        expect(state.result.current.value).toMatchObject({ value: 5 })
      );
    });
    it("use() correctly exposes custom actions", async () => {
      const q = quark(
        { value: 0 },
        { actions: { increment: (s) => ({ value: s.value + 1 }) } }
      );

      const state = renderHook(() => q.use());

      expect(state.result.current.value).toMatchObject({ value: 0 });

      act(() => {
        state.result.current.increment();
      });

      await state.waitFor(() =>
        expect(state.result.current.value).toMatchObject({ value: 1 })
      );
    });
    it("use() correctly exposes custom selectors with parameters", async () => {
      const q = quark(["a", "b", "c", "d"], {
        selectors: {
          index(s, index: number) {
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

      expect(state.result.current).toEqual("c");

      state.rerender({ index: 0 });

      await state.waitFor(() => expect(state.result.current).toEqual("a"));
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

      expect(state.result.current.value).toMatchObject({ value: 0 });

      await act(async () => {
        await state.result.current.incrementAsync();
      });

      await state.waitFor(() =>
        expect(state.result.current.value).toMatchObject({ value: 1 })
      );
    });
    it("use() correctly triggers custom effects when local set is called", async () => {
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

      expect(state.result.current.value).toMatchObject({ value: 0 });

      act(() => {
        state.result.current.set({ value: 1 });
      });

      await state.waitFor(() =>
        expect(state.result.current.value).toMatchObject({ value: 2 })
      );
    });
    it("use() correctly triggers custom effects when global set is called", async () => {
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

      expect(state.result.current.value).toMatchObject({ value: 0 });

      act(() => {
        q.set({ value: 1 });
      });

      await state.waitFor(() =>
        expect(state.result.current.value).toMatchObject({ value: 2 })
      );
    });
    it("use() correctly triggers custom effects when local custom action is called", async () => {
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

      expect(state.result.current.value).toMatchObject({ value: 0 });

      act(() => {
        state.result.current.increment();
      });

      await state.waitFor(() =>
        expect(state.result.current.value).toMatchObject({ value: 2 })
      );
    });
    it("use() correctly triggers custom effects when global custom action is called", async () => {
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

      expect(state.result.current.value).toMatchObject({ value: 0 });

      act(() => {
        q.increment();
      });

      await state.waitFor(() =>
        expect(state.result.current.value).toMatchObject({ value: 2 })
      );
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

      expect(state.result.current.value).toMatchObject({
        value: 0,
        derivedValue: "0",
      });

      await act(async () => {
        await state.result.current.increment();
      });

      await state.waitFor(() =>
        expect(state.result.current.value).toMatchObject({
          value: 1,
          derivedValue: "1",
        })
      );
    });
    it("useSelector() correctly avoids unnecessary re-renders", async () => {
      const q = quark({ value1: 0, value2: 100 });
      const reRenderCounter = vitest.fn();

      const selectV1 = (a: QuarkType<typeof q>) => a.value1;

      const state = renderHook(() => {
        reRenderCounter();
        return q.useSelector(selectV1);
      });

      expect(q.get().value2).toEqual(100);
      expect(state.result.current).toEqual(0);
      expect(reRenderCounter).toHaveBeenCalledTimes(1);

      await act(async () => {
        q.set((s) => ({ ...s, value1: 5 }));

        await sleep(0);
      });

      expect(q.get().value2).toEqual(100);
      await state.waitFor(() => {
        expect(state.result.current).toEqual(5);
      });
      expect(reRenderCounter).toHaveBeenCalledTimes(2);

      await act(async () => {
        q.set((s) => ({ ...s, value2: 99 }));

        await sleep(0);
      });

      expect(q.get().value2).toEqual(99);
      await state.waitFor(() => expect(state.result.current).toEqual(5));
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
            value1: (s) => s.value1,
          },
        }
      );
      const reRenderCounter = vitest.fn();

      const state = renderHook(() => {
        reRenderCounter();
        return q.useValue1();
      });

      expect(q.get().value2).toEqual(321);
      expect(state.result.current).toEqual(1);
      expect(reRenderCounter).toHaveBeenCalledTimes(1);

      await act(async () => {
        q.SetVal1(15);
        await sleep(0);
      });

      expect(q.get().value2).toEqual(321);
      await state.waitFor(() => expect(state.result.current).toEqual(15));
      expect(reRenderCounter).toHaveBeenCalledTimes(2);

      await act(async () => {
        q.SetVal2(55);
        await sleep(20);
      });

      expect(q.get().value2).toEqual(55);
      expect(state.result.current).toEqual(15);
      expect(reRenderCounter).toHaveBeenCalledTimes(2);
    });
    it("useSelector() correctly handles situations where the selector returns a different value on each rerender", async () => {
      const q = quark([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      const { result, rerender } = renderHook(() =>
        q.useSelector((s) => s.filter((x) => !(x % 2)))
      );

      expect(result.current).toEqual([0, 2, 4, 6, 8]);

      rerender();

      expect(result.current).toEqual([0, 2, 4, 6, 8]);
    });
    it("custom selectors correctly handles situations where the selector returns a different value on each rerender", async () => {
      const q = quark([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], {
        selectors: {
          evenNumbers(state) {
            return state.filter((x) => !(x % 2));
          },
        },
      });

      const { result, rerender } = renderHook(() => q.useEvenNumbers());

      expect(result.current).toEqual([0, 2, 4, 6, 8]);

      rerender();

      expect(result.current).toEqual([0, 2, 4, 6, 8]);
    });
    it("custom selectors correctly handles arguments", async () => {
      const q = quark([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], {
        selectors: {
          sumOf(state, a: number, b: number) {
            return state.slice(a, b).reduce((acc, x) => acc + x, 0);
          },
        },
      });

      const { result, rerender } = renderHook(
        (props: { a: number; b: number }) => q.useSumOf(props.a, props.b),
        {
          initialProps: {
            a: 0,
            b: 3,
          },
        }
      );

      expect(result.current).toEqual(3);

      rerender({ a: 1, b: 5 });

      expect(result.current).toEqual(10);
    });
    describe("procedures", () => {
      it("correctly update the state with yielded values", async () => {
        const p = controlledPromise<{ value: number }>();

        const q = quark(
          { inProgress: false, value: 2 },
          {
            procedures: {
              async *runProcedure(initState) {
                yield { ...initState, inProgress: true };
                const newValue = await p.promise;
                return { inProgress: false, value: newValue.value };
              },
            },
          }
        );

        const state = renderHook(() => q.use());

        await act(async () => {
          state.result.current.runProcedure();
          await sleep(0);
        });
        expect(state.result.current.value).toMatchObject({
          inProgress: true,
          value: 2,
        });

        await act(async () => {
          p.resolve({ value: 5 });
          await sleep(0);
        });
        expect(state.result.current.value).toMatchObject({
          inProgress: false,
          value: 5,
        });
      });
      it("correctly update the state with yielded fn setters", async () => {
        const p = controlledPromise<{ value: number }>();

        const q = quark(
          { inProgress: false, value: 2 },
          {
            procedures: {
              async *runProcedure() {
                yield (current) => ({ ...current, inProgress: true });
                const newValue = await p.promise;
                return () => ({ inProgress: false, value: newValue.value });
              },
            },
          }
        );

        const state = renderHook(() => q.use());

        await act(async () => {
          state.result.current.runProcedure();
          await sleep(0);
        });
        expect(state.result.current.value).toMatchObject({
          inProgress: true,
          value: 2,
        });

        await act(async () => {
          p.resolve({ value: 5 });
          await sleep(0);
        });
        expect(state.result.current.value).toMatchObject({
          inProgress: false,
          value: 5,
        });
      });
      it("correctly update the state with yielded fn setters and immer", async () => {
        const p = controlledPromise<{ value: number }>();

        const q = quark(
          { inProgress: false, value: 20 },
          {
            middlewares: [createImmerMiddleware()],
            procedures: {
              async *runProcedure() {
                yield (draft) => {
                  draft.inProgress = true;
                  return draft;
                };
                const newValue = await p.promise;
                return (draft) => {
                  draft.inProgress = false;
                  draft.value = newValue.value;
                  return draft;
                };
              },
            },
          }
        );

        const state = renderHook(() => q.use());

        await act(async () => {
          state.result.current.runProcedure();
          await sleep(0);
        });
        expect(state.result.current.value).toMatchObject({
          inProgress: true,
          value: 20,
        });

        await act(async () => {
          p.resolve({ value: 1234 });
          await sleep(0);
        });
        expect(state.result.current.value).toMatchObject({
          inProgress: false,
          value: 1234,
        });
      });
      it("interrupts a procedure if another state update happens", async () => {
        const p1 = controlledPromise<{ value: number }>();
        const p2 = controlledPromise<{ value: number }>();

        const q = quark(
          { inProgress: false, value: 2 },
          {
            procedures: {
              async *runProcedure() {
                yield { inProgress: true, value: 0 };
                const newValue = await p1.promise;
                yield { inProgress: true, value: newValue.value };
                const newValue2 = await p2.promise;
                return { inProgress: false, value: newValue2.value };
              },
            },
          }
        );

        const state = renderHook(() => q.use());

        await act(async () => {
          state.result.current.runProcedure();
          await sleep(0);
        });
        expect(state.result.current.value).toMatchObject({
          inProgress: true,
          value: 0,
        });

        await act(async () => {
          p1.resolve({ value: 10 });
          await sleep(0);
        });
        expect(state.result.current.value).toMatchObject({
          inProgress: true,
          value: 10,
        });

        await act(async () => {
          state.result.current.set({ inProgress: false, value: 15 });
        });
        expect(state.result.current.value).toMatchObject({
          inProgress: false,
          value: 15,
        });

        await act(async () => {
          p2.resolve({ value: 20 });
          await sleep(0);
        });
        expect(state.result.current.value).toMatchObject({
          inProgress: false,
          value: 15,
        });
      });
      it("interrupts a procedure if an async state update happens", async () => {
        const p1 = controlledPromise<{ value: number }>();
        const p2 = controlledPromise<{ value: number }>();

        const q = quark(
          { inProgress: false, value: 2 },
          {
            procedures: {
              async *runProcedure() {
                yield { inProgress: true, value: 0 };
                const newValue = await p1.promise;
                yield { inProgress: true, value: newValue.value };
                const newValue2 = await p2.promise;
                return { inProgress: false, value: newValue2.value };
              },
            },
            actions: {
              async fetchValue(s) {
                await sleep(0);
                return { value: 100, inProgress: false };
              },
            },
          }
        );

        const state = renderHook(() => q.use());

        await act(async () => {
          state.result.current.runProcedure();
          await sleep(0);
        });
        expect(state.result.current.value).toMatchObject({
          inProgress: true,
          value: 0,
        });

        await act(async () => {
          await state.result.current.fetchValue();
        });
        expect(state.result.current.value).toMatchObject({
          inProgress: false,
          value: 100,
        });

        await act(async () => {
          p1.resolve({ value: 10 });
          await sleep(0);
        });
        expect(state.result.current.value).toMatchObject({
          inProgress: false,
          value: 100,
        });

        await act(async () => {
          p2.resolve({ value: 20 });
          await sleep(0);
        });
        expect(state.result.current.value).toMatchObject({
          inProgress: false,
          value: 100,
        });
      });
    });
  });

  describe("async updates correctly avoid race conditions", () => {
    describe("for raw Promises", () => {
      describe("for a async final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" });

          const setSpy = vitest.spyOn(q, "set");

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
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(2)
          );
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(4)
          );
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(8)
          );
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(16)
          );
        });

        it("(batch size of 24)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(24)
          );
        });

        it("(batch size of 64)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(64)
          );
        });

        it("(batch size of 128)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(128)
          );
        });

        it("(batch size of 256)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(256)
          );
        });

        it("(batch size of 512)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(512)
          );
        });

        it("(batch size of 1024)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(1024)
          );
        });
      });
      describe("for a sync final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" });

          const setSpy = vitest.spyOn(q, "set");

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
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(1)
          );
        });

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(2)
          );
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(4)
          );
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(8)
          );
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(16)
          );
        });
      });
      describe("for a async generator final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" });

          const setSpy = vitest.spyOn(q, "set");

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
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(2)
          );
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(4)
          );
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(8)
          );
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(16)
          );
        });

        it("(batch size of 24)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(24)
          );
        });

        it("(batch size of 64)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(64)
          );
        });

        it("(batch size of 128)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(128)
          );
        });

        it("(batch size of 256)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(256)
          );
        });

        it("(batch size of 512)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(512)
          );
        });

        it("(batch size of 1024)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(1024)
          );
        });
      });
      describe("for a sync generator final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" });

          const setSpy = vitest.spyOn(q, "set");

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
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(1)
          );
        });

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(2)
          );
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(4)
          );
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(8)
          );
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(16)
          );
        });
      });
    });

    describe("for Promise generators", () => {
      describe("for a async final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" });

          const setSpy = vitest.spyOn(q, "set");

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
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(2)
          );
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(4)
          );
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(8)
          );
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(16)
          );
        });

        it("(batch size of 24)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(24)
          );
        });

        it("(batch size of 64)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(64)
          );
        });

        it("(batch size of 128)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(128)
          );
        });

        it("(batch size of 256)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(256)
          );
        });

        it("(batch size of 512)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(512)
          );
        });

        it("(batch size of 1024)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(1024)
          );
        });
      });
      describe("for a sync final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" });

          const setSpy = vitest.spyOn(q, "set");

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
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(1)
          );
        });

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(2)
          );
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(4)
          );
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(8)
          );
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(16)
          );
        });
      });
      describe("for a async generator final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" });

          const setSpy = vitest.spyOn(q, "set");

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
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(2)
          );
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(4)
          );
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(8)
          );
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(16)
          );
        });

        it("(batch size of 24)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(24)
          );
        });

        it("(batch size of 64)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(64)
          );
        });

        it("(batch size of 128)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(128)
          );
        });

        it("(batch size of 256)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(256)
          );
        });

        it("(batch size of 512)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(512)
          );
        });

        it("(batch size of 1024)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(1024)
          );
        });
      });
      describe("for a sync generator final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" });

          const setSpy = vitest.spyOn(q, "set");

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
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(1)
          );
        });

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(2)
          );
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(4)
          );
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(8)
          );
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(16)
          );
        });
      });
    });

    describe("for raw Promises and Promise generators together", () => {
      describe("for a async final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" });

          const setSpy = vitest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = testPromiseGenerator();

          for (const _ in array(batchSize)) {
            if (rndBool()) {
              q.set(
                promises.generate(() => rndTResolve({ value: rndString() }))
              );
            } else {
              q.set(() =>
                promises.generate(() => rndTResolve({ value: rndString() }))
              );
            }
          }

          if (rndBool())
            q.set(promises.generate(() => rndTResolve(expectedResult)));
          else
            q.set(() => promises.generate(() => rndTResolve(expectedResult)));

          await promises.waitForAll();

          expect(setSpy).toBeCalledTimes(batchSize + 1);
          expect(q.get()).toMatchObject(expectedResult);
        }

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(2)
          );
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(4)
          );
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(8)
          );
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(16)
          );
        });

        it("(batch size of 24)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(24)
          );
        });

        it("(batch size of 64)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(64)
          );
        });

        it("(batch size of 128)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(128)
          );
        });

        it("(batch size of 256)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(256)
          );
        });

        it("(batch size of 512)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(512)
          );
        });

        it("(batch size of 1024)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(1024)
          );
        });
      });
      describe("for a sync generator final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" });

          const setSpy = vitest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = testPromiseGenerator();

          for (const _ in array(batchSize)) {
            if (rndBool())
              q.set(
                promises.generate(() => rndTResolve({ value: rndString() }))
              );
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
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(1)
          );
        });

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(2)
          );
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(4)
          );
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(8)
          );
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(array(32), () =>
            runTestWithRandomPromiseResolveTime(16)
          );
        });
      });
    });
  });
});
