import { act, renderHook } from "@testing-library/react-hooks";
import type { QuarkMiddleware, QuarkType } from "../src";
import { quark } from "../src";

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

      q.set(promiseB);

      q.set(promiseA);

      expect(q.get()).toEqual("A");

      await promiseA;

      expect(q.get()).toEqual("FOO");

      await promiseB;

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

      q.set(promiseD);

      q.set("CORGE");

      expect(q.get()).toEqual("CORGE");

      await promiseC;

      expect(q.get()).toEqual("CORGE");

      await promiseD;

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
        const fooMiddleware: QuarkMiddleware<string, 1 | 2> = (_, value, resume) => {
          if (typeof value === "number") {
            resume({ 1: "BAR", 2: "BAZ" }[value]);
          } else {
            resume(value);
          }
        };

        const q = quark("FOO", { middlewares: [fooMiddleware] });

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
          resume(value * 2);
        };
        const subtractMiddleware: QuarkMiddleware<number, number> = (
          _,
          value,
          resume
        ) => {
          resume(value - 1);
        };
        const squareMiddleware: QuarkMiddleware<number, number> = (
          _,
          value,
          resume
        ) => {
          resume(value ** 2);
        };

        const q = quark(0, {
          middlewares: [multiplyMiddleware, subtractMiddleware, squareMiddleware],
        });

        q.set(2);

        expect(q.get()).toEqual((2 * 2 - 1) ** 2);
      });
    });
    describe("correctly executes side effect", () => {
      it("when set() is called", () => {
        const q = quark(
          { value: 0, derivedValue: "0" },
          {
            actions: {
              increment(state) {
                return { ...state, value: state.value + 1 };
              },
              setDerivedValue(state, newDerivedValue: string) {
                return { ...state, derivedValue: newDerivedValue };
              },
            },
          },
          {
            deriveValue(prevState, newState, actions) {
              if (prevState.value !== newState.value) {
                actions.setDerivedValue(`${newState.value}`);
              }
            },
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
              increment(state) {
                return { ...state, value: state.value + 1 };
              },
              setDerivedValue(state, newDerivedValue: string) {
                return { ...state, derivedValue: newDerivedValue };
              },
            },
          },
          {
            deriveValue(prevState, newState, actions) {
              if (prevState.value !== newState.value) {
                actions.setDerivedValue(`${newState.value}`);
              }
            },
          }
        );

        expect(q.get()).toMatchObject({ value: 0, derivedValue: "0" });

        q.increment();

        expect(q.get()).toMatchObject({ value: 1, derivedValue: "1" });
      });
      it("with nested effects", () => {
        const q = quark(
          {
            value: 0,
            derivedValue1: "0",
            derivedValue2: "0-0",
            derivedValue3: "0-0-0-0",
          },
          {
            actions: {
              increment(state) {
                return { ...state, value: state.value + 1 };
              },
              setDerivedValue1(state, newDerivedValue: string) {
                return { ...state, derivedValue1: `${newDerivedValue}` };
              },
              setDerivedValue2(state, newDerivedValue: string) {
                return { ...state, derivedValue2: `${newDerivedValue}` };
              },
              setDerivedValue3(state, newDerivedValue: string) {
                return { ...state, derivedValue3: `${newDerivedValue}` };
              },
            },
          },
          {
            deriveValue1(prevState, newState, actions) {
              if (prevState.value !== newState.value) {
                actions.setDerivedValue1(`${newState.value}`);
              }
            },
            deriveValue2(prevState, newState, actions) {
              if (prevState.derivedValue1 !== newState.derivedValue1) {
                actions.setDerivedValue2(
                  `${newState.derivedValue1}-${newState.derivedValue1}`
                );
              }
            },
            deriveValue3(prevState, newState, actions) {
              if (prevState.derivedValue2 !== newState.derivedValue2) {
                actions.setDerivedValue3(
                  `${newState.derivedValue2}-${newState.derivedValue2}`
                );
              }
            },
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
    it("use() correctly triggers custom effects when local set is called", () => {
      const q = quark(
        { value: 0 },
        { actions: { increment: (s) => ({ value: s.value + 1 }) } },
        {
          assureEven(_, curr, actions) {
            if (curr.value % 2 !== 0) {
              actions.set({ value: curr.value + 1 });
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
        { actions: { increment: (s) => ({ value: s.value + 1 }) } },
        {
          assureEven(_, curr, actions) {
            if (curr.value % 2 !== 0) {
              actions.set({ value: curr.value + 1 });
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
        { actions: { increment: (s) => ({ value: s.value + 1 }) } },
        {
          assureEven(_, curr, actions) {
            if (curr.value % 2 !== 0) {
              actions.set({ value: curr.value + 1 });
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
        { actions: { increment: (s) => ({ value: s.value + 1 }) } },
        {
          assureEven(_, curr, actions) {
            if (curr.value % 2 !== 0) {
              actions.set({ value: curr.value + 1 });
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
    it("useSelector() correctly avoids unnecessary re-renders", () => {
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

      act(() => {
        q.set((s) => ({ ...s, value1: 5 }));
      });

      expect(q.get().value2).toEqual(100);
      expect(state.result.current.get()).toEqual(5);
      expect(reRenderCounter).toHaveBeenCalledTimes(2);

      act(() => {
        q.set((s) => ({ ...s, value2: 99 }));
      });

      expect(q.get().value2).toEqual(99);
      expect(state.result.current.get()).toEqual(5);
      expect(reRenderCounter).toHaveBeenCalledTimes(2);
    });
    it("custom selectors correctly avoid unnecessary re-renders", () => {
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

      act(() => {
        q.SetVal1(15);
      });

      expect(q.get().value2).toEqual(321);
      expect(state.result.current.get()).toEqual(15);
      expect(reRenderCounter).toHaveBeenCalledTimes(2);

      act(() => {
        q.SetVal2(55);
      });

      expect(q.get().value2).toEqual(55);
      expect(state.result.current.get()).toEqual(15);
      expect(reRenderCounter).toHaveBeenCalledTimes(2);
    });
  });
});
