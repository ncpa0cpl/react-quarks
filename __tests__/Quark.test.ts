import { act, renderHook } from "@testing-library/react-hooks";
import { describe, expect, it, vitest } from "vitest";
import type {
  ActionApi,
  QuarkMiddleware,
  QuarkSetterFn,
  QuarkType,
} from "../src";
import { composeSelectors, createImmerMiddleware, quark } from "../src";
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
            increment(api) {
              api.setState({ value: api.getState().value + 1 });
            },
            multiply(api, by: number) {
              api.setState({ value: api.getState().value * by });
            },
          },
        },
      );

      expect(q.get()).toMatchObject({ value: 0 });

      q.act.increment();

      expect(q.get()).toMatchObject({ value: 1 });

      q.act.multiply(12);

      expect(q.get()).toMatchObject({ value: 12 });
    });
    it("correctly handles selectors", () => {
      const q = quark(
        { value1: 5, value2: 321 },
        {
          actions: {
            SetVal1: (api, v: number) =>
              void api.setState({ ...api.getState(), value1: v }),
            SetVal2: (api, v: number) =>
              void api.setState({ ...api.getState(), value2: v }),
          },
        },
      );

      const selectV1 = (s: QuarkType<typeof q>) => s.value1;
      const selectV2 = (s: QuarkType<typeof q>) => s.value2;
      const selectSum = (s: QuarkType<typeof q>) => s.value1 + s.value2;

      expect(q.select.$(selectV1)).toEqual(5);
      expect(q.select.$(selectV2)).toEqual(321);
      expect(q.select.$(selectSum)).toEqual(326);

      q.act.SetVal1(10);

      expect(q.select.$(selectV1)).toEqual(10);
      expect(q.select.$(selectSum)).toEqual(331);
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
          if (updateType !== "async-generator" && typeof action === "number") {
            resume(action - 1);
          } else resume(action);
        };
        const squareMiddleware: QuarkMiddleware<any, number> = ({
          action,
          resume,
          updateType,
        }) => {
          if (updateType !== "async-generator" && typeof action === "number") {
            resume(action ** 2);
          } else resume(action);
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

      const increment = (api: ActionApi<Q>) => {
        api.setState({ ...api.getState(), value: api.getState().value + 1 });
      };

      const setDerivedValue = (
        api: ActionApi<Q>,
        newDerivedValue: string,
      ) => {
        api.setState({ ...api.getState(), derivedValue: newDerivedValue });
      };

      const deriveValue = (
        prevState: Q,
        newState: Q,
        set: QuarkSetterFn<Q, never>,
      ) => {
        if (prevState.value !== newState.value) {
          setDerivedValue(
            { getState: () => newState, setState: set } as any,
            `${newState.value}`,
          );
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
          },
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
          },
        );

        expect(q.get()).toMatchObject({ value: 0, derivedValue: "0" });

        q.act.increment();

        expect(q.get()).toMatchObject({ value: 1, derivedValue: "1" });
      });
      it("with nested effects", () => {
        type Q = {
          value: number;
          derivedValue1: string;
          derivedValue2: string;
          derivedValue3: string;
        };

        const increment = (api: ActionApi<Q>) => {
          api.setState({ ...api.getState(), value: api.getState().value + 1 });
        };

        const deriveValue = (
          prevState: Q,
          newState: Q,
          set: QuarkSetterFn<Q, never>,
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
          },
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
    describe("custom actions", () => {
      it("prevents updates if a newer update has been dispatched", async () => {
        let secondsSetStateWasCalled = false;
        const q = quark({ value: 0 }, {
          actions: {
            async setValue(api, value1: number, value2: number) {
              api.setState({ value: value1 });
              await sleep(20);
              api.setState({ value: value2 });
              secondsSetStateWasCalled = true;
            },
          },
        });

        q.act.setValue(5, 20);

        await sleep(0);

        expect(q.get()).toMatchObject({ value: 5 });

        q.set({ value: 123 });
        expect(secondsSetStateWasCalled).toBe(false);

        await sleep(50);

        expect(q.get()).toMatchObject({ value: 123 });
        expect(secondsSetStateWasCalled).toBe(true);
      });
      describe("dispatchNew()", () => {
        it("behaves as if a separate action was dispatched from outside", async () => {
          const onSetV3 = vitest.fn();

          const q = quark({ value: 0 }, {
            actions: {
              async action(api, v1: number, v2: number, v3: number) {
                api.setState({ value: v1 });
                api.dispatchNew(async (subApi) => {
                  await sleep(25);
                  subApi.setState({ value: v2 });
                });
                await sleep(50);
                api.setState({ value: v3 });
                onSetV3();
              },
            },
          });

          expect(onSetV3).toHaveBeenCalledTimes(0);

          q.act.action(5, 10, 15);
          await sleep(0);
          expect(q.get()).toMatchObject({ value: 5 });

          await sleep(30);
          expect(q.get()).toMatchObject({ value: 10 });

          await sleep(100);
          expect(q.get()).toMatchObject({ value: 10 });
          expect(onSetV3).toHaveBeenCalledTimes(1);

          const p1 = controlledPromise();
          const p2 = controlledPromise();

          const q2 = quark({ value: 0 }, {
            actions: {
              async action(api, v1: number, v2: number) {
                api.setState({ value: v1 });
                await p1;
                api.dispatchNew((subApi) => {
                  subApi.setState({ value: v2 });
                });
              },
            },
          });

          q2.act.action(5, 10);
          expect(q2.get()).toMatchObject({ value: 5 });

          q2.set(async () => {
            await p2;
            return { value: 999 };
          });

          p1.resolve();
          await sleep(0);
          expect(q2.get()).toMatchObject({ value: 10 });
          // dispatchNew cancels the p2 update
          p2.resolve();
          await sleep(10);
          expect(q2.get()).toMatchObject({ value: 10 });
        });
      });
      describe("unsafeSet()", () => {
        it("should update the state even if the current action was canceled", async () => {
          const q = quark({ value: "0", value2: "0" }, {
            actions: {
              async action(api) {
                api.setState({ value: "5", value2: "0" });
                await sleep(20);
                expect(api.isCanceled()).toBe(true);
                api.unsafeSet({ ...api.getState(), value: "unsafely set" }); // should take effect
                api.setState({ ...api.getState(), value2: "10" }); // should not take effect
              },
            },
          });

          q.act.action();

          expect(q.get()).toMatchObject({ value: "5", value2: "0" });

          q.set(c => ({ ...c, value: "123" })); // cancels the action
          expect(q.get()).toMatchObject({ value: "123", value2: "0" });

          await sleep(30);

          expect(q.get()).toMatchObject({ value: "unsafely set", value2: "0" });
        });
        it("should not cancel in-flight updates", async () => {
          const p1 = controlledPromise();
          const p2 = controlledPromise();

          const q = quark({ value: 0 }, {
            actions: {
              async action(api) {
                api.setState({ value: 5 });
                await p1.promise;
                expect(api.isCanceled()).toBe(true);
                api.unsafeSet({ value: 10 });
              },
            },
            procedures: {
              async *update() {
                yield { value: 999 };
                await p2.promise;
                return { value: 876 };
              },
            },
          });

          q.act.action();
          expect(q.get()).toMatchObject({ value: 5 });

          // create an in-flight update
          q.act.update();
          await sleep(0);
          expect(q.get()).toMatchObject({ value: 999 });

          p1.resolve();
          await sleep(0);
          expect(q.get()).toMatchObject({ value: 10 }); // unsafeSet should take effect

          p2.resolve();
          await sleep(0);
          expect(q.get()).toMatchObject({ value: 876 }); // in-flight update should take effect
        });
        it("correctly handles setter functions", async () => {
          const q = quark({ value: 0 }, {
            middlewares: [createImmerMiddleware()],
            actions: {
              async action(api) {
                api.setState({ value: 5 });
                await sleep(20);
                expect(api.isCanceled()).toBe(true);
                api.unsafeSet((draft) => {
                  draft.value = 10;
                  return draft;
                });
              },
            },
          });

          q.act.action();
          expect(q.get()).toMatchObject({ value: 5 });

          q.set(draft => {
            draft.value = -1;
            return draft;
          });
          expect(q.get()).toMatchObject({ value: -1 });

          await sleep(30);
          expect(q.get()).toMatchObject({ value: 10 });
        });
      });
    });
    describe("custom selectors", () => {
      it("returns the selected value", () => {
        const q = quark(
          { value1: 5, value2: 321 },
          {
            actions: {
              SetVal1: (api, v: number) =>
                void api.setState({ ...api.getState(), value1: v }),
              SetVal2: (api, v: number) =>
                void api.setState({ ...api.getState(), value2: v }),
            },
            selectors: {
              value1: (s) => s.value1,
              value2: (s) => s.value2,
              valueSum: (s) => s.value1 + s.value2,
            },
          },
        );

        expect(q.select.value1()).toEqual(5);
        expect(q.select.value2()).toEqual(321);
        expect(q.select.valueSum()).toEqual(326);

        q.act.SetVal1(10);

        expect(q.select.value1()).toEqual(10);
        expect(q.select.valueSum()).toEqual(331);
      });
      it("correctly handle arguments", () => {
        const q = quark(
          { value1: 5, value2: 321 },
          {
            actions: {
              SetVal1: (api, v: number) =>
                void api.setState({ ...api.getState(), value1: v }),
              SetVal2: (api, v: number) =>
                void api.setState({ ...api.getState(), value2: v }),
            },
            selectors: {
              v: (s, n: 1 | 2) => s[`value${n}`],
              multipliedBy: (s, n: number) => s.value1 * n,
            },
          },
        );

        expect(q.select.v(1)).toEqual(5);
        expect(q.select.v(2)).toEqual(321);
        expect(q.select.multipliedBy(12)).toEqual(60);

        q.act.SetVal1(69);

        expect(q.select.v(1)).toEqual(69);
        expect(q.select.multipliedBy(10)).toEqual(690);
      });
    });
    describe("procedures", () => {
      it("correctly update the state with yielded values", async () => {
        const p = controlledPromise<{ value: number }>();

        const q = quark(
          { inProgress: false, value: 2 },
          {
            procedures: {
              async *runProcedure(api) {
                yield { ...api.getState(), inProgress: true };
                const newValue = await p.promise;
                return { inProgress: false, value: newValue.value };
              },
            },
          },
        );

        q.act.runProcedure();

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
          },
        );

        q.act.runProcedure();

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
          },
        );

        q.act.runProcedure();

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
          },
        );

        q.act.runProcedure();
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
              async fetchValue(api) {
                await sleep(0);
                api.setState({ value: 100, inProgress: false });
              },
            },
          },
        );

        q.act.runProcedure();
        await sleep(0);
        expect(q.get()).toMatchObject({ inProgress: true, value: 0 });

        await q.act.fetchValue();
        expect(q.get()).toMatchObject({ inProgress: false, value: 100 });

        p1.resolve({ value: 10 });
        await sleep(0);
        expect(q.get()).toMatchObject({ inProgress: false, value: 100 });

        p2.resolve({ value: 20 });
        await sleep(0);
        expect(q.get()).toMatchObject({ inProgress: false, value: 100 });
      });
      it("correctly handles unsafeSet", async () => {
        const p = controlledPromise<{ value: number }>();

        const q = quark(
          { inProgress: false, value: 2 },
          {
            procedures: {
              async *runProcedure(api) {
                yield { ...api.getState(), inProgress: true };
                const newValue = await p.promise;
                api.unsafeSet({ inProgress: false, value: newValue.value });
                return { inProgress: false, value: -1 };
              },
            },
          },
        );

        q.act.runProcedure();
        await sleep(0);
        expect(q.get()).toMatchObject({ inProgress: true, value: 2 });

        q.set({ inProgress: false, value: 123 });
        expect(q.get()).toMatchObject({ inProgress: false, value: 123 });

        p.resolve({ value: 5 });
        await sleep(0);
        expect(q.get()).toMatchObject({ inProgress: false, value: 5 });
      });
      it("correctly handles unsafeSet with setter function", async () => {
        const p = controlledPromise<{ value: number }>();

        const q = quark(
          { inProgress: false, value: 2 },
          {
            middlewares: [createImmerMiddleware()],
            procedures: {
              async *runProcedure(api) {
                yield { ...api.getState(), inProgress: true };
                const newValue = await p.promise;
                expect(api.isCanceled()).toBe(true);
                api.unsafeSet((draft) => {
                  draft.value = newValue.value;
                  return draft;
                });
                return { inProgress: false, value: -1 };
              },
            },
          },
        );

        q.act.runProcedure();
        await sleep(0);
        expect(q.get()).toMatchObject({ inProgress: true, value: 2 });

        q.set({ inProgress: false, value: 123 });
        expect(q.get()).toMatchObject({ inProgress: false, value: 123 });

        p.resolve({ value: 5 });
        await sleep(0);
        expect(q.get()).toMatchObject({ inProgress: false, value: 5 });
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
        {
          actions: {
            increment: (api) =>
              void api.setState({ value: api.getState().value + 1 }),
          },
        },
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
          return q.select.useIndex(props.index);
        },
        {
          initialProps: { index: 2 },
        },
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
            incrementAsync: (api) =>
              void api.setState(
                Promise.resolve({ value: api.getState().value + 1 }),
              ),
          },
        },
      );

      const state = renderHook(() => q.use());

      expect(state.result.current.value).toMatchObject({ value: 0 });

      await act(async () => {
        state.result.current.incrementAsync();
        await state.waitFor(() => {
          expect(state.result.current.value).toMatchObject({ value: 1 });
        });
      });
    });
    it("use() correctly triggers custom effects when local set is called", async () => {
      const q = quark(
        { value: 0 },
        {
          actions: {
            increment: (api) =>
              void api.setState({ value: api.getState().value + 1 }),
          },
          effect: (_, curr, set) => {
            if (curr.value % 2 !== 0) {
              set({ value: curr.value + 1 });
            }
          },
        },
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
          actions: {
            increment: (api) =>
              void api.setState({ value: api.getState().value + 1 }),
          },
          effect: (_, curr, set) => {
            if (curr.value % 2 !== 0) {
              set({ value: curr.value + 1 });
            }
          },
        },
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
          actions: {
            increment: (api) =>
              void api.setState({ value: api.getState().value + 1 }),
          },
          effect: (_, curr, set) => {
            if (curr.value % 2 !== 0) {
              set({ value: curr.value + 1 });
            }
          },
        },
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
          actions: {
            increment: (api) =>
              void api.setState({ value: api.getState().value + 1 }),
          },
          effect: (_, curr, set) => {
            if (curr.value % 2 !== 0) {
              set({ value: curr.value + 1 });
            }
          },
        },
      );

      const state = renderHook(() => q.use());

      expect(state.result.current.value).toMatchObject({ value: 0 });

      act(() => {
        q.act.increment();
      });

      await state.waitFor(() =>
        expect(state.result.current.value).toMatchObject({ value: 2 })
      );
    });
    it("use() correctly rerenders when an effect dispatches a Promise", async () => {
      const q = quark(
        { value: 0, derivedValue: "0" },
        {
          actions: {
            increment: (api) =>
              void api.setState({
                ...api.getState(),
                value: api.getState().value + 1,
              }),
          },
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
        },
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
        return q.select.use(selectV1);
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
    it("useSelector() correctly handles situations where the selector returns a different value on each rerender", async () => {
      const q = quark([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      const { result, rerender } = renderHook(() =>
        q.select.use((s) => s.filter((x) => !(x % 2)))
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

      const { result, rerender } = renderHook(() => q.select.useEvenNumbers());

      expect(result.current).toEqual([0, 2, 4, 6, 8]);

      rerender();

      expect(result.current).toEqual([0, 2, 4, 6, 8]);

      q.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      await sleep(0);

      expect(result.current).toEqual([0, 2, 4, 6, 8, 10]);
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
        (props: { a: number; b: number }) =>
          q.select.useSumOf(props.a, props.b),
        {
          initialProps: {
            a: 0,
            b: 3,
          },
        },
      );

      expect(result.current).toEqual(3);

      rerender({ a: 1, b: 5 });

      expect(result.current).toEqual(10);
    });
    describe("avoid unnecessary re-renders", () => {
      it("custom selectors with primitive", async () => {
        const q = quark(
          { value1: 1, value2: 321 },
          {
            actions: {
              SetVal1: (api, v: number) =>
                void api.setState({ ...api.getState(), value1: v }),
              SetVal2: (api, v: number) =>
                void api.setState({ ...api.getState(), value2: v }),
            },
            selectors: {
              value1: (s) => s.value1,
            },
          },
        );
        const reRenderCounter = vitest.fn();

        const state = renderHook(() => {
          reRenderCounter();
          return q.select.useValue1();
        });

        expect(q.get().value2).toEqual(321);
        expect(state.result.current).toEqual(1);
        expect(reRenderCounter).toHaveBeenCalledTimes(1);

        await act(async () => {
          q.act.SetVal1(15);
          await sleep(0);
        });

        expect(q.get().value2).toEqual(321);
        await state.waitFor(() => expect(state.result.current).toEqual(15));
        expect(reRenderCounter).toHaveBeenCalledTimes(2);

        await act(async () => {
          q.act.SetVal2(55);
          await sleep(20);
        });

        expect(q.get().value2).toEqual(55);
        expect(state.result.current).toEqual(15);
        expect(reRenderCounter).toHaveBeenCalledTimes(2);
      });
      it("custom selector of nested stable object", async () => {
        const q = quark(
          { box1: { value: "hello" }, box2: { value: "world" } },
          {
            actions: {
              SetVal1: (api, v: string) =>
                void api.setState({
                  ...api.getState(),
                  box1: { value: v },
                }),
              SetVal2: (api, v: string) =>
                void api.setState({
                  ...api.getState(),
                  box2: { value: v },
                }),
            },
            selectors: {
              value1: (s) => s.box1,
            },
          },
        );
        const reRenderCounter = vitest.fn();

        const state = renderHook(() => {
          reRenderCounter();
          return q.select.useValue1();
        });

        expect(state.result.current).toEqual({ value: "hello" });
        expect(reRenderCounter).toHaveBeenCalledTimes(1);

        await act(async () => {
          q.act.SetVal1("HELLO");
          await sleep(0);
        });

        await state.waitFor(() =>
          expect(state.result.current).toEqual({ value: "HELLO" })
        );
        expect(reRenderCounter).toHaveBeenCalledTimes(2);

        await act(async () => {
          q.act.SetVal2("WORLD");
          await sleep(20);
        });

        expect(state.result.current).toEqual({ value: "HELLO" });
        expect(reRenderCounter).toHaveBeenCalledTimes(2);
      });
      it("custom composed selectors", async () => {
        const q = quark(
          { value1: 1, value2: 321 },
          {
            actions: {
              SetVal1: (api, v: number) =>
                void api.setState({ ...api.getState(), value1: v }),
              SetVal2: (api, v: number) =>
                void api.setState({ ...api.getState(), value2: v }),
            },
            selectors: {
              boxed: composeSelectors(
                (s) => s.value1,
                (v1) => ({ value: v1 }),
              ),
            },
          },
        );
        const reRenderCounter = vitest.fn();

        const state = renderHook(() => {
          reRenderCounter();
          return q.select.useBoxed();
        });

        expect(q.get().value2).toEqual(321);
        expect(state.result.current).toEqual({ value: 1 });
        expect(reRenderCounter).toHaveBeenCalledTimes(1);

        await act(async () => {
          q.act.SetVal1(15);
          await sleep(0);
        });

        expect(q.get().value2).toEqual(321);
        await state.waitFor(() =>
          expect(state.result.current).toEqual({ value: 15 })
        );
        expect(reRenderCounter).toHaveBeenCalledTimes(2);

        await act(async () => {
          q.act.SetVal2(55);
          await sleep(20);
        });

        expect(q.get().value2).toEqual(55);
        expect(state.result.current).toEqual({ value: 15 });
        expect(reRenderCounter).toHaveBeenCalledTimes(2);
      });
      it("custom composed selectors with arguments", async () => {
        const q = quark([{ value: "1" }, { value: "2" }, { value: "3" }], {
          selectors: {
            boxed: composeSelectors(
              (s, idx: number) => s[idx],
              (v, idx) => v[idx],
              (v1, v2, idx) => ({ v1, v2, idx }),
            ),
          },
        });
        const reRenderCounter = vitest.fn();

        const state = renderHook(
          (props: { idx: number }) => {
            reRenderCounter();
            return q.select.useBoxed(props.idx);
          },
          { initialProps: { idx: 0 } },
        );

        expect(state.result.current).toEqual({
          idx: 0,
          v1: { value: "1" },
          v2: { value: "1" },
        });
        expect(reRenderCounter).toHaveBeenCalledTimes(1);

        await act(async () => {
          q.set((current) => {
            return current.map((v, idx) => {
              if (idx === 0) return { value: "15" };
              return v;
            });
          });
          await sleep(0);
        });

        await state.waitFor(() =>
          expect(state.result.current).toEqual({
            idx: 0,
            v1: { value: "15" },
            v2: { value: "15" },
          })
        );
        expect(reRenderCounter).toHaveBeenCalledTimes(2);

        await act(async () => {
          q.set((current) => {
            return current.map((v, idx) => {
              if (idx === 0) return v;
              if (idx === 1) return { value: "432" };
              if (idx === 2) return { value: "000" };
              return v;
            });
          });
          await sleep(0);
        });

        expect(state.result.current).toEqual({
          idx: 0,
          v1: { value: "15" },
          v2: { value: "15" },
        });
        expect(reRenderCounter).toHaveBeenCalledTimes(2);

        state.rerender({ idx: 1 });
        expect(state.result.current).toEqual({
          idx: 1,
          v1: { value: "432" },
          v2: { value: "432" },
        });
        expect(reRenderCounter).toHaveBeenCalledTimes(3);

        state.rerender({ idx: 2 });
        expect(state.result.current).toEqual({
          idx: 2,
          v1: { value: "000" },
          v2: { value: "000" },
        });
        expect(reRenderCounter).toHaveBeenCalledTimes(4);

        await act(async () => {
          q.set((current) => {
            return current.map((v, idx) => {
              if (idx === 0) return { value: "111" };
              return v;
            });
          });
          await sleep(0);
        });
        expect(state.result.current).toEqual({
          idx: 2,
          v1: { value: "000" },
          v2: { value: "000" },
        });
        expect(reRenderCounter).toHaveBeenCalledTimes(4);
      });
      it("multiple simultaneous selectors with different params", async () => {
        const q = quark([1, 2, 3, 4], {
          selectors: {
            idx(state, idx: number) {
              const entry = state[idx];
              return { value: entry };
            },
          },
        });

        let i = 0;
        const reRenderCounter = vitest.fn(() => {
          i++;
          if (i > 10) {
            throw new Error("Too many re-renders");
          }
        });

        const state1 = renderHook(() => {
          reRenderCounter();
          return {
            idx0: q.select.useIdx(0),
            idx1: q.select.useIdx(1),
          };
        });

        expect(reRenderCounter).toHaveBeenCalledTimes(1);
        expect(state1.result.current).toEqual({
          idx0: { value: 1 },
          idx1: { value: 2 },
        });

        await act(async () => {
          q.set([10, 2, 3, 4]);
          await sleep(0);
        });

        expect(reRenderCounter).toHaveBeenCalledTimes(2);
        expect(state1.result.current).toEqual({
          idx0: { value: 10 },
          idx1: { value: 2 },
        });

        await state1.waitFor(() =>
          expect(state1.result.current).toEqual({
            idx0: { value: 10 },
            idx1: { value: 2 },
          })
        );
      });
      it("simultaneous selectors with different params exceeding cache max entries", async () => {
        const q = quark([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], {
          selectors: {
            idx(state, idx: number) {
              const entry = state[idx];
              return { value: entry };
            },
          },
        });

        let i = 0;
        const reRenderCounter = vitest.fn(() => {
          i++;
          if (i > 10) {
            throw new Error("Too many re-renders");
          }
        });

        const state1 = renderHook(() => {
          reRenderCounter();
          return {
            idx0: q.select.useIdx(0),
            idx1: q.select.useIdx(1),
            idx2: q.select.useIdx(2),
            idx3: q.select.useIdx(3),
            idx4: q.select.useIdx(4),
            idx5: q.select.useIdx(5),
            idx6: q.select.useIdx(6),
            idx7: q.select.useIdx(7),
            idx8: q.select.useIdx(8),
            idx9: q.select.useIdx(9),
            idx10: q.select.useIdx(10),
            idx11: q.select.useIdx(11),
          };
        });

        expect(reRenderCounter).toHaveBeenCalledTimes(1);
        expect(state1.result.current).toEqual({
          idx0: { value: 1 },
          idx1: { value: 2 },
          idx2: { value: 3 },
          idx3: { value: 4 },
          idx4: { value: 5 },
          idx5: { value: 6 },
          idx6: { value: 7 },
          idx7: { value: 8 },
          idx8: { value: 9 },
          idx9: { value: 10 },
          idx10: { value: 11 },
          idx11: { value: 12 },
        });

        await act(async () => {
          q.set([1, 2, 3, 4, 5, 951, 7, 8, 9, 10, 11, 12]);
          await sleep(0);
        });

        expect(reRenderCounter).toHaveBeenCalledTimes(2);
        expect(state1.result.current).toEqual({
          idx0: { value: 1 },
          idx1: { value: 2 },
          idx2: { value: 3 },
          idx3: { value: 4 },
          idx4: { value: 5 },
          idx5: { value: 951 },
          idx6: { value: 7 },
          idx7: { value: 8 },
          idx8: { value: 9 },
          idx9: { value: 10 },
          idx10: { value: 11 },
          idx11: { value: 12 },
        });
      });
    });
    describe("procedures", () => {
      it("correctly update the state with yielded values", async () => {
        const p = controlledPromise<{ value: number }>();

        const q = quark(
          { inProgress: false, value: 2 },
          {
            procedures: {
              async *runProcedure(api) {
                yield { ...api.getState(), inProgress: true };
                const newValue = await p.promise;
                return { inProgress: false, value: newValue.value };
              },
            },
          },
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
          },
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
          },
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
          },
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
              async fetchValue(api) {
                await sleep(0);
                api.setState({ value: 100, inProgress: false });
              },
            },
          },
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
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(2),
          );
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(4),
          );
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(8),
          );
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(16),
          );
        });

        it("(batch size of 24)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(24),
          );
        });

        it("(batch size of 64)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(64),
          );
        });

        it("(batch size of 128)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(128),
          );
        });

        it("(batch size of 256)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(256),
          );
        });

        it("(batch size of 512)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(512),
          );
        });

        it("(batch size of 1024)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(1024),
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
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(1),
          );
        });

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(2),
          );
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(4),
          );
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(8),
          );
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(16),
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
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(2),
          );
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(4),
          );
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(8),
          );
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(16),
          );
        });

        it("(batch size of 24)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(24),
          );
        });

        it("(batch size of 64)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(64),
          );
        });

        it("(batch size of 128)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(128),
          );
        });

        it("(batch size of 256)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(256),
          );
        });

        it("(batch size of 512)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(512),
          );
        });

        it("(batch size of 1024)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(1024),
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
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(1),
          );
        });

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(2),
          );
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(4),
          );
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(8),
          );
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(16),
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
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(2),
          );
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(4),
          );
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(8),
          );
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(16),
          );
        });

        it("(batch size of 24)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(24),
          );
        });

        it("(batch size of 64)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(64),
          );
        });

        it("(batch size of 128)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(128),
          );
        });

        it("(batch size of 256)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(256),
          );
        });

        it("(batch size of 512)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(512),
          );
        });

        it("(batch size of 1024)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(1024),
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
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(1),
          );
        });

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(2),
          );
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(4),
          );
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(8),
          );
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(16),
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
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(2),
          );
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(4),
          );
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(8),
          );
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(16),
          );
        });

        it("(batch size of 24)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(24),
          );
        });

        it("(batch size of 64)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(64),
          );
        });

        it("(batch size of 128)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(128),
          );
        });

        it("(batch size of 256)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(256),
          );
        });

        it("(batch size of 512)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(512),
          );
        });

        it("(batch size of 1024)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(1024),
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
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(1),
          );
        });

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(2),
          );
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(4),
          );
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(8),
          );
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(16),
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
                promises.generate(() => rndTResolve({ value: rndString() })),
              );
            } else {
              q.set(() =>
                promises.generate(() => rndTResolve({ value: rndString() }))
              );
            }
          }

          if (rndBool()) {
            q.set(promises.generate(() => rndTResolve(expectedResult)));
          } else {
            q.set(() => promises.generate(() => rndTResolve(expectedResult)));
          }

          await promises.waitForAll();

          expect(setSpy).toBeCalledTimes(batchSize + 1);
          expect(q.get()).toMatchObject(expectedResult);
        }

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(2),
          );
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(4),
          );
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(8),
          );
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(16),
          );
        });

        it("(batch size of 24)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(24),
          );
        });

        it("(batch size of 64)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(64),
          );
        });

        it("(batch size of 128)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(128),
          );
        });

        it("(batch size of 256)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(256),
          );
        });

        it("(batch size of 512)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(512),
          );
        });

        it("(batch size of 1024)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(1024),
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
            if (rndBool()) {
              q.set(
                promises.generate(() => rndTResolve({ value: rndString() })),
              );
            } else {
              q.set(() =>
                promises.generate(() => rndTResolve({ value: rndString() }))
              );
            }
          }

          if (rndBool()) q.set(expectedResult);
          else q.set(() => expectedResult);

          await promises.waitForAll();

          expect(setSpy).toBeCalledTimes(batchSize + 1);
          expect(q.get()).toMatchObject(expectedResult);
        }

        it("(batch size of 1)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(1),
          );
        });

        it("(batch size of 2)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(2),
          );
        });

        it("(batch size of 4)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(4),
          );
        });

        it("(batch size of 8)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(8),
          );
        });

        it("(batch size of 16)", async () => {
          expect.assertions(32 * 2);
          await forAwait(
            array(32),
            () => runTestWithRandomPromiseResolveTime(16),
          );
        });
      });
    });
  });
});
