import { act, renderHook } from "@testing-library/react-hooks";
import { describe, expect, it, vitest } from "vitest";
import type {
  ActionApi,
  QuarkCustomEffect,
  QuarkMiddleware,
  QuarkSetterFn,
  QuarkType,
} from "../src";
import {
  addGlobalQuarkMiddleware,
  composeSelectors,
  createImmerMiddleware,
  middleware,
  quark,
} from "../src";
import {
  array,
  controlledPromise,
  forAwait,
  opTracker,
  rndBool,
  rndString,
  rndTResolve,
  sleep,
  testPromiseGenerator,
} from "./helpers";

// @ts-expect-error
global.IS_REACT_ACT_ENVIRONMENT = true;

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
      const q = quark("A", { mode: "cancel" });

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
              api.set({ value: api.get().value + 1 });
            },
            multiply(api, by: number) {
              api.set({ value: api.get().value * by });
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
              void api.set({ ...api.get(), value1: v }),
            SetVal2: (api, v: number) =>
              void api.set({ ...api.get(), value2: v }),
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
        const mapMiddleware: QuarkMiddleware<string> = {
          onValue(ctx) {
            if (typeof ctx.action === "number") {
              return ctx.next({ 1: "BAR", 2: "BAZ" }[ctx.action]!);
            } else {
              return ctx.skip();
            }
          },
        };

        const q = quark("FOO", { middlewares: [mapMiddleware] });

        // @ts-expect-error
        q.set(1);

        expect(q.get()).toEqual("BAR");

        q.set("QUX");

        expect(q.get()).toEqual("QUX");
      });
      it("resume() correctly pipes results from one middleware to the next", () => {
        const multiplyMiddleware: QuarkMiddleware<number> = {
          onValue(ctx) {
            return ctx.next(ctx.action * 2);
          },
        };
        const subtractMiddleware: QuarkMiddleware<number> = {
          onValue(ctx) {
            return ctx.next(ctx.action - 1);
          },
        };
        const squareMiddleware: QuarkMiddleware<number> = {
          onValue(ctx) {
            return ctx.next(ctx.action ** 2);
          },
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
      it("global middlewares added after quark was created take effect", () => {
        const interceptedActions: any[] = [];
        const logMd = middleware({
          onValue(ctx) {
            interceptedActions.push(ctx.action);
            return ctx.skip();
          },
        });

        const q = quark({ foo: 1 });
        q.set({ foo: 2 });

        expect(interceptedActions.length).toEqual(0);

        addGlobalQuarkMiddleware(logMd);

        q.set({ foo: 3 });

        expect(interceptedActions.length).toEqual(1);
        expect(interceptedActions[0]).toEqual({ foo: 3 });
      });
    });
    describe("correctly executes side effect", () => {
      type Q = {
        value: number;
        derivedValue: string;
      };

      const increment = (api: ActionApi<Q>) => {
        api.set({ ...api.get(), value: api.get().value + 1 });
      };

      const setDerivedValue = (
        api: ActionApi<Q>,
        newDerivedValue: string,
      ) => {
        api.set({ ...api.get(), derivedValue: newDerivedValue });
      };

      const deriveValue = (
        prevState: Q,
        newState: Q,
        set: QuarkSetterFn<Q>,
      ) => {
        if (prevState.value !== newState.value) {
          setDerivedValue(
            { get: () => newState, set: set } as any,
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
          api.set({ ...api.get(), value: api.get().value + 1 });
        };

        const deriveValue = (
          prevState: Q,
          newState: Q,
          set: QuarkSetterFn<Q>,
        ) => {
          if (prevState.value !== newState.value) {
            set((v) => ({ ...v, derivedValue1: `${v.value}` }));
            set((v) => ({
              ...v,
              derivedValue2: `${v.derivedValue1}-${v.derivedValue1}`,
            }));
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
        const p1 = controlledPromise();

        let secondsSetStateWasCalled = false;
        const q = quark({ value: 0 }, {
          mode: "cancel",
          actions: {
            async setValue(api, value1: number, value2: number) {
              api.set({ value: value1 });
              await p1.promise;
              api.set({ value: value2 });
              secondsSetStateWasCalled = true;
            },
          },
        });

        q.act.setValue(5, 20);

        await sleep(0);

        expect(q.get()).toMatchObject({ value: 5 });

        q.set({ value: 123 });
        expect(secondsSetStateWasCalled).toBe(false);

        p1.resolve();
        await sleep(0);

        expect(q.get()).toMatchObject({ value: 123 });
        expect(secondsSetStateWasCalled).toBe(true);
      });
      describe("dispatchNew()", () => {
        it("behaves as if a separate action was dispatched from outside", async () => {
          const onSetV3 = vitest.fn();
          const p1 = controlledPromise();
          const p2 = controlledPromise();
          const p3 = controlledPromise();

          const q = quark({ value: 0 }, {
            mode: "cancel",
            actions: {
              async action(api, v1: number, v2: number, v3: number) {
                api.set({ value: v1 });
                api.dispatchNew(async (subApi) => {
                  debugger;
                  await p2.promise;
                  subApi.set({ value: v2 });
                });
                await p3.promise;
                api.set({ value: v3 });
                onSetV3();
              },
            },
          });

          expect(onSetV3).toHaveBeenCalledTimes(0);

          q.act.action(5, 10, 15);
          await sleep(0);
          expect(q.get()).toMatchObject({ value: 5 });

          p2.resolve();
          await sleep(0);
          expect(q.get()).toMatchObject({ value: 10 });

          p3.resolve();
          await sleep(0);
          expect(q.get()).toMatchObject({ value: 10 });
          expect(onSetV3).toHaveBeenCalledTimes(1);

          // const p1 = controlledPromise();
          // const p2 = controlledPromise();

          // const q2 = quark({ value: 0 }, {
          //   mode: "cancel",
          //   actions: {
          //     async action(api, v1: number, v2: number) {
          //       api.set({ value: v1 });
          //       await p1;
          //       api.dispatchNew((subApi) => {
          //         subApi.set({ value: v2 });
          //       });
          //     },
          //   },
          // });

          // q2.act.action(5, 10);
          // expect(q2.get()).toMatchObject({ value: 5 });

          // q2.set(async () => {
          //   await p2;
          //   return { value: 999 };
          // });

          // p1.resolve();
          // await sleep(0);
          // expect(q2.get()).toMatchObject({ value: 10 });
          // // dispatchNew cancels the p2 update
          // p2.resolve();
          // await sleep(10);
          // expect(q2.get()).toMatchObject({ value: 10 });
        });

        it("can be given other action from `this`", async () => {
          const q = quark({ value: 0 }, {
            actions: {
              double(api) {
                api.set(s => ({ value: s.value * 2 }));
              },
              add(api, amount: number) {
                api.set({ value: api.get().value + amount });
              },
              action(api) {
                api.set({ value: 4 });
                api.dispatchNew(this.add, 3);
                api.dispatchNew(this.double);
              },
            },
          });

          q.act.action();

          expect(q.get()).toEqual({ value: 14 });
        });

        it("can be given other procedures from `this`", async () => {
          const breakpoint1 = controlledPromise();
          const breakpoint2 = controlledPromise();
          const breakpoint3 = controlledPromise();
          const breakpoint4 = controlledPromise();

          const q = quark({ value: 0 }, {
            actions: {
              async *gen(api, v1: number, v2: number) {
                await breakpoint1.promise;
                yield { value: v1 };
                await breakpoint4.promise;
                return { value: v2 };
              },
              async action(api) {
                api.set({ value: 1 });
                api.dispatchNew(this.gen, 5, 7);
                await breakpoint2.promise;
                api.set({ value: 2 });
                await breakpoint3.promise;
              },
            },
          });

          q.act.action();
          await sleep(0);
          expect(q.get()).toEqual({ value: 1 });

          breakpoint1.resolve();
          await sleep(0);
          expect(q.get()).toEqual({ value: 1 });

          await breakpoint2.resolve();
          expect(q.get()).toEqual({ value: 2 });

          await breakpoint3.resolve();
          await breakpoint1.dependenciesResolved;
          expect(q.get()).toEqual({ value: 5 });

          await breakpoint4.resolve();
          expect(q.get()).toEqual({ value: 7 });
        });
      });
      describe("unsafeSet()", () => {
        it("should update the state even if the current action was canceled", async () => {
          const q = quark({ value: "0", value2: "0" }, {
            mode: "cancel",
            actions: {
              async action(api) {
                api.set({ value: "5", value2: "0" });
                await sleep(20);
                expect(api.isCanceled()).toBe(true);
                api.unsafeSet({ ...api.get(), value: "unsafely set" }); // should take effect
                api.set({ ...api.get(), value2: "10" }); // should not take effect
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
            mode: "cancel",
            actions: {
              async action(api) {
                api.set({ value: 5 });
                await p1.promise;
                expect(api.isCanceled()).toBe(true);
                api.unsafeSet({ value: 10 });
              },
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
            mode: "cancel",
            middlewares: [createImmerMiddleware()],
            actions: {
              async action(api) {
                api.set({ value: 5 });
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
                void api.set({ ...api.get(), value1: v }),
              SetVal2: (api, v: number) =>
                void api.set({ ...api.get(), value2: v }),
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
                void api.set({ ...api.get(), value1: v }),
              SetVal2: (api, v: number) =>
                void api.set({ ...api.get(), value2: v }),
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
            mode: "cancel",
            actions: {
              async *runProcedure(api) {
                yield { ...api.get(), inProgress: true };
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
            mode: "cancel",
            actions: {
              foo(api, value: number): void {
                return;
              },
              bar(api, value: number) {},
              async *runProcedure(api) {
                this.foo(api, 1);
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
            actions: {
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
            mode: "cancel",
            actions: {
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
            mode: "cancel",
            actions: {
              async fetchValue(api) {
                await sleep(0);
                api.set({ value: 100, inProgress: false });
              },
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
            mode: "cancel",
            actions: {
              async *runProcedure(api) {
                yield { ...api.get(), inProgress: true };
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
      it("foobar correctly handles unsafeSet with setter function", async () => {
        const p = controlledPromise<{ value: number }>();

        const q = quark(
          { inProgress: false, value: 2 },
          {
            mode: "cancel",
            middlewares: [createImmerMiddleware()],
            actions: {
              async *runProcedure(api) {
                yield { ...api.get(), inProgress: true };
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
      it("noop", async () => {
        const p = controlledPromise<number>();
        const p2 = controlledPromise();

        const q = quark(
          2,
          {
            actions: {
              async *endWithNoop(api) {
                yield p.promise;
                return api.noop();
              },
              async *noopInTheMiddle(api) {
                yield -1;
                yield api.noop();
                await p2.promise;
                yield -2;
                return -3;
              },
            },
          },
        );

        const procd = q.act.endWithNoop();

        await sleep(0);

        expect(q.get()).toEqual(2);

        await p.resolve(5);
        await procd;

        expect(q.get()).toEqual(5);

        const prcd2 = q.act.noopInTheMiddle();

        await sleep(1);
        expect(q.get()).toEqual(-1);

        await p2.resolve();
        await prcd2;

        expect(q.get()).toEqual(-3);
      });
    });
    describe("assign helper", () => {
      it("applies a patch correctly", () => {
        const q = quark({
          foo: { bar: { baz: { value: "a", x: 3 }, x: 2 }, x: 1 },
          topVal: "TOP",
        });

        expect(q.get()).toEqual({
          foo: { bar: { baz: { value: "a", x: 3 }, x: 2 }, x: 1 },
          topVal: "TOP",
        });

        q.assign({ topVal: "BOTTOM" });

        expect(q.get()).toEqual({
          foo: { bar: { baz: { value: "a", x: 3 }, x: 2 }, x: 1 },
          topVal: "BOTTOM",
        });

        q.assign(
          s => s.foo.bar.baz,
          { value: "VALUE" },
        );

        expect(q.get()).toEqual({
          foo: { bar: { baz: { value: "VALUE", x: 3 }, x: 2 }, x: 1 },
          topVal: "BOTTOM",
        });
      });
      it("in actions and procedures", async () => {
        const p = controlledPromise<number[]>();

        const q = quark({
          v1: "v1",
          v2: "v2",
          v3: [1, 2, 3],
        }, {
          actions: {
            action(api) {
              api.assign({ v1: "new v1" });
            },
            async *proc(api) {
              yield api.assign({ v2: "new v2" });
              const arr = await p.promise;
              yield api.assign({ v3: arr });
              return api.get();
            },
          },
        });

        expect(q.get()).toEqual({ v1: "v1", v2: "v2", v3: [1, 2, 3] });

        q.act.action();

        expect(q.get()).toEqual({ v1: "new v1", v2: "v2", v3: [1, 2, 3] });

        q.act.proc();
        await sleep(0);

        expect(q.get()).toEqual({ v1: "new v1", v2: "new v2", v3: [1, 2, 3] });

        p.resolve([0]);
        await sleep(0);

        expect(q.get()).toEqual({ v1: "new v1", v2: "new v2", v3: [0] });
      });
      it("with selector in actions and procedures", async () => {
        const p = controlledPromise<number[]>();

        const q = quark({
          v1: "v1",
          v2: {
            v3: "v3",
            v4: [
              { v5: "v5.1" },
              { v5: "v5.2" },
            ],
          },
        }, {
          actions: {
            setV3(api) {
              api.assign(s => s.v2, { v3: "foobar" });
            },
            async *proc(api) {
              yield api.assign(s => s.v2.v4, [{ v5: "up" }]);
              return api.get();
            },
          },
        });

        expect(q.get()).toEqual({
          v1: "v1",
          v2: {
            v3: "v3",
            v4: [
              { v5: "v5.1" },
              { v5: "v5.2" },
            ],
          },
        });

        q.act.setV3();

        expect(q.get()).toEqual({
          v1: "v1",
          v2: {
            v3: "foobar",
            v4: [
              { v5: "v5.1" },
              { v5: "v5.2" },
            ],
          },
        });

        q.act.proc();
        await sleep(0);

        expect(q.get()).toEqual({
          v1: "v1",
          v2: {
            v3: "foobar",
            v4: [
              { v5: "up" },
              { v5: "v5.2" },
            ],
          },
        });
      });
      it("with empty object does nothing", () => {
        const q = quark({
          value: "original",
          nested: { foo: "bar" },
        });

        const beforeAssign = q.get();
        q.assign({});

        expect(q.get()).toEqual(beforeAssign);
      });
      it("with arrays", () => {
        const q = quark({
          arr: [1, 2, 3],
          other: "value",
        });

        q.assign({ arr: [4, 5] });

        expect(q.get()).toEqual({
          arr: [4, 5],
          other: "value",
        });
      });
      it("multiple times in sequence", () => {
        const q = quark({
          a: 1,
          b: 2,
          c: 3,
        });

        q.assign({ a: 10 });
        q.assign({ b: 20 });
        q.assign({ c: 30 });

        expect(q.get()).toEqual({
          a: 10,
          b: 20,
          c: 30,
        });
      });
      it("with deeply nested selector", () => {
        const q = quark({
          level1: {
            level2: {
              level3: {
                level4: {
                  value: "deep",
                  other: "untouched",
                },
              },
            },
          },
        });

        q.assign(
          s => s.level1.level2.level3.level4,
          { value: "changed" },
        );

        expect(q.get()).toEqual({
          level1: {
            level2: {
              level3: {
                level4: {
                  value: "changed",
                  other: "untouched",
                },
              },
            },
          },
        });
      });
      it("with array index selector", () => {
        const q = quark({
          items: [{ id: 1, name: "first" }, { id: 2, name: "second" }],
        });

        q.assign(s => s.items[0], { name: "modified" });

        expect(q.get()).toEqual({
          items: [{ id: 1, name: "modified" }, { id: 2, name: "second" }],
        });
      });
      it("notifies subscribers", async () => {
        const q = quark({
          value: "original",
        });

        const subscriber = vitest.fn();
        q.subscribe(subscriber);

        q.assign({ value: "new" });

        await sleep(0);

        expect(subscriber).toHaveBeenCalledTimes(1);
        expect(subscriber).toHaveBeenCalledWith(
          { value: "new" },
          expect.any(Function),
        );
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
            increment: (api) => void api.set({ value: api.get().value + 1 }),
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
              void api.set(
                Promise.resolve({ value: api.get().value + 1 }),
              ),
          },
        },
      );

      const state = renderHook(() => q.use());

      expect(state.result.current.value).toMatchObject({ value: 0 });

      await act(async () => {
        await state.result.current.incrementAsync();
      });

      await state.waitFor(() => {
        expect(state.result.current.value).toMatchObject({ value: 1 });
      });
    });
    it("use() correctly triggers custom effects when local set is called", async () => {
      const q = quark(
        { value: 0 },
        {
          actions: {
            increment: (api) => void api.set({ value: api.get().value + 1 }),
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
            increment: (api) => void api.set({ value: api.get().value + 1 }),
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
            increment: (api) => void api.set({ value: api.get().value + 1 }),
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
            increment: (api) => void api.set({ value: api.get().value + 1 }),
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
              void api.assign({
                value: api.get().value + 1,
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

      await sleep(5);

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
                void api.set({ ...api.get(), value1: v }),
              SetVal2: (api, v: number) =>
                void api.set({ ...api.get(), value2: v }),
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
                void api.set({
                  ...api.get(),
                  box1: { value: v },
                }),
              SetVal2: (api, v: string) =>
                void api.set({
                  ...api.get(),
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
                void api.set({ ...api.get(), value1: v }),
              SetVal2: (api, v: number) =>
                void api.set({ ...api.get(), value2: v }),
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
            actions: {
              async *runProcedure(api) {
                yield { ...api.get(), inProgress: true };
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
            actions: {
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
            actions: {
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
            mode: "cancel",
            actions: {
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
            mode: "cancel",
            actions: {
              async *runProcedure() {
                yield { inProgress: true, value: 0 };
                const newValue = await p1.promise;
                yield { inProgress: true, value: newValue.value };
                const newValue2 = await p2.promise;
                return { inProgress: false, value: newValue2.value };
              },
              async fetchValue(api) {
                await sleep(0);
                api.set({ value: 100, inProgress: false });
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
    describe("assign helper", () => {
      it("use() with assign() triggers re-renders correctly", async () => {
        const q = quark({
          value: 0,
          name: "counter",
        });

        const state = renderHook(() => q.use());

        expect(state.result.current.value).toMatchObject({
          value: 0,
          name: "counter",
        });

        act(() => {
          state.result.current.assign({ value: 5 });
        });

        await state.waitFor(() =>
          expect(state.result.current.value).toMatchObject({
            value: 5,
            name: "counter",
          })
        );
      });

      it("use() with assign() and selector triggers re-renders correctly", async () => {
        const q = quark({
          nested: {
            value: 0,
            other: "untouched",
          },
        });

        const state = renderHook(() => q.use());

        expect(state.result.current.value).toEqual({
          nested: {
            value: 0,
            other: "untouched",
          },
        });

        act(() => {
          state.result.current.assign(s => s.nested, { value: 10 });
        });

        await state.waitFor(() =>
          expect(state.result.current.value).toEqual({
            nested: {
              value: 10,
              other: "untouched",
            },
          })
        );
      });

      it("use() with assign() in custom actions", async () => {
        const q = quark(
          { value: 0, name: "counter" },
          {
            actions: {
              increment(api) {
                api.assign({ value: api.get().value + 1 });
              },
              setName(api) {
                api.assign({ name: "modified" });
              },
            },
          },
        );

        const state = renderHook(() => q.use());

        expect(state.result.current.value).toMatchObject({
          value: 0,
          name: "counter",
        });

        act(() => {
          state.result.current.increment();
        });

        await state.waitFor(() =>
          expect(state.result.current.value).toMatchObject({
            value: 1,
            name: "counter",
          })
        );

        act(() => {
          state.result.current.setName();
        });

        await state.waitFor(() =>
          expect(state.result.current.value).toMatchObject({
            value: 1,
            name: "modified",
          })
        );
      });

      it("useSelector() correctly avoids unnecessary re-renders with assign()", async () => {
        const q = quark(
          {
            value1: "a",
            value2: "b",
          },
          {
            selectors: {
              value1: (s) => s.value1,
            },
          },
        );

        let renderCount = 0;
        const state = renderHook(() => {
          renderCount++;
          return q.select.useValue1();
        });

        expect(state.result.current).toBe("a");
        const initialRenderCount = renderCount;

        // Assign to value1 - should trigger re-render
        act(() => {
          q.assign({ value1: "c" });
        });

        await state.waitFor(() => {
          expect(state.result.current).toBe("c");
        });
        expect(renderCount).toBe(initialRenderCount + 1);

        // Assign to value2 - should NOT trigger re-render
        act(() => {
          q.assign({ value2: "d" });
        });

        await sleep(0);
        expect(state.result.current).toBe("c");
        expect(renderCount).toBe(initialRenderCount + 1);
      });

      it("assign() with async procedure", async () => {
        const q = quark(
          { value: 0, loading: false },
          {
            actions: {
              async *fetchValue(api) {
                yield api.assign({ loading: true });
                return api.assign({ value: 42, loading: false });
              },
            },
          },
        );

        const state = renderHook(() => q.use());

        expect(state.result.current.value).toEqual({
          value: 0,
          loading: false,
        });

        await act(async () => {
          await state.result.current.fetchValue();
        });

        await state.waitFor(() =>
          expect(state.result.current.value).toEqual({
            value: 42,
            loading: false,
          })
        );
      });

      it("assign() with deeply nested state", async () => {
        const q = quark({
          level1: {
            level2: {
              level3: {
                items: [{ id: 1, name: "item1" }, { id: 2, name: "item2" }],
              },
            },
          },
        });

        const state = renderHook(() => q.use());

        act(() => {
          state.result.current.assign(
            s => s.level1.level2.level3.items[0],
            { name: "modified" },
          );
        });

        await state.waitFor(() =>
          expect(state.result.current.value).toEqual({
            level1: {
              level2: {
                level3: {
                  items: [{ id: 1, name: "modified" }, {
                    id: 2,
                    name: "item2",
                  }],
                },
              },
            },
          })
        );
      });
    });
  });

  describe("async updates correctly avoid race conditions", () => {
    describe("for raw Promises", () => {
      describe("for a async final update", () => {
        async function runTestWithRandomPromiseResolveTime(batchSize: number) {
          const q = quark({ value: "foo" }, {
            mode: "cancel",
          });

          const setSpy = vitest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = opTracker();

          for (const _ in array(batchSize)) {
            promises.add(q.set(rndTResolve({ value: rndString() })));
          }

          promises.add(q.set(rndTResolve(expectedResult)));

          await promises.flush();

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
          const q = quark({ value: "foo" }, {
            mode: "cancel",
          });

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
          const q = quark({ value: "foo" }, {
            mode: "cancel",
          });

          const setSpy = vitest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = opTracker();

          for (const _ in array(batchSize)) {
            promises.add(
              q.set(rndTResolve({ value: rndString() })),
            );
          }

          promises.add(
            q.set(rndTResolve(expectedResult)),
          );

          await promises.flush();

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
          const q = quark({ value: "foo" }, {
            mode: "cancel",
          });

          const setSpy = vitest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = opTracker();

          for (const _ in array(batchSize)) {
            promises.add(
              q.set(rndTResolve({ value: rndString() })),
            );
          }

          q.set(() => expectedResult);

          await promises.flush();

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
          const q = quark({ value: "foo" }, {
            mode: "cancel",
          });

          const setSpy = vitest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = opTracker();

          for (const _ in array(batchSize)) {
            promises.add(
              q.set(() => rndTResolve({ value: rndString() })),
            );
          }

          promises.add(
            q.set(rndTResolve(expectedResult)),
          );

          await promises.flush();

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
          const q = quark({ value: "foo" }, {
            mode: "cancel",
          });

          const setSpy = vitest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = opTracker();

          for (const _ in array(batchSize)) {
            promises.add(
              q.set(() => rndTResolve({ value: rndString() })),
            );
          }

          q.set(expectedResult);

          await promises.flush();

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
          const q = quark({ value: "foo" }, {
            mode: "cancel",
          });

          const setSpy = vitest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = opTracker();

          for (const _ in array(batchSize)) {
            promises.add(
              q.set(() => rndTResolve({ value: rndString() })),
            );
          }

          promises.add(
            q.set(() => rndTResolve(expectedResult)),
          );

          await promises.flush();

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
          const q = quark({ value: "foo" }, {
            mode: "cancel",
          });

          const setSpy = vitest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = opTracker();

          for (const _ in array(batchSize)) {
            promises.add(
              q.set(() => rndTResolve({ value: rndString() })),
            );
          }

          q.set(() => expectedResult);

          await promises.flush();

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
          const q = quark({ value: "foo" }, {
            mode: "cancel",
          });

          const setSpy = vitest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = opTracker();

          for (const _ in array(batchSize)) {
            if (rndBool()) {
              promises.add(
                q.set(
                  rndTResolve({ value: rndString() }),
                ),
              );
            } else {
              promises.add(
                q.set(
                  rndTResolve(() => ({ value: rndString() })),
                ),
              );
            }
          }

          if (rndBool()) {
            promises.add(
              q.set(
                rndTResolve(expectedResult),
              ),
            );
          } else {
            promises.add(
              q.set(rndTResolve(() => expectedResult)),
            );
          }

          await promises.flush();

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
          const q = quark({ value: "foo" }, {
            mode: "cancel",
          });

          const setSpy = vitest.spyOn(q, "set");

          const expectedResult = { value: "bar" };

          const promises = opTracker();

          for (const _ in array(batchSize)) {
            if (rndBool()) {
              promises.add(
                q.set(
                  rndTResolve({ value: rndString() }),
                ),
              );
            } else {
              promises.add(
                q.set(() => rndTResolve({ value: rndString() })),
              );
            }
          }

          if (rndBool()) q.set(expectedResult);
          else q.set(() => expectedResult);

          await promises.flush();

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

  describe("queue mode", () => {
    it("async updates are applied in the order the were dispatched", async () => {
      const initState = {
        order: [] as string[],
      };
      const q = quark(initState, {
        mode: "queue",
      });

      const p1 = sleep(100).then(() => (state: typeof initState) => {
        return ({
          order: [...state.order, "first"],
        });
      });
      const dispatch1 = q.set(p1);

      const p2 = sleep(25).then(() => (state: typeof initState) => {
        return ({
          order: [...state.order, "second"],
        });
      });
      const dispatch2 = q.set(p2);

      const p3 = (state: typeof initState) => {
        return ({
          order: [...state.order, "third"],
        });
      };
      const dispatch3 = q.set(p3);

      const p4 = sleep(50).then(() => (state: typeof initState) => {
        return ({
          order: [...state.order, "fourth"],
        });
      });
      const dispatch4 = q.set(p4);

      await Promise.all([
        dispatch1,
        dispatch2,
        dispatch3,
        dispatch4,
      ]);

      expect(q.get().order).toEqual([
        "first",
        "second",
        "third",
        "fourth",
      ]);
    });

    it("async actions are correctly queued", async () => {
      const initState = {
        order: [] as string[],
      };

      const q = quark(initState, {
        mode: "queue",
        actions: {
          add(api, value: string) {
            const newState = { order: [...api.get().order] };
            newState.order.push(value);
            api.set(newState);
          },
          async addAfter(api, after: number, value: string) {
            const newState = { order: [...api.get().order] };
            newState.order.push(value);
            await sleep(after);
            api.set(newState);
          },
        },
      });

      await Promise.all([
        q.act.addAfter(120, "first"),
        q.act.addAfter(80, "second"),
        q.act.addAfter(40, "third"),
        q.act.add("fourth"),
        q.act.addAfter(100, "fifth"),
        q.act.add("sixth"),
        q.act.addAfter(20, "seventh"),
      ]);

      expect(q.get()).toEqual({
        order: [
          "first",
          "second",
          "third",
          "fourth",
          "fifth",
          "sixth",
          "seventh",
        ],
      });
    });

    it("async procedures are correctly queued", async () => {
      const initState = {
        order: [] as string[],
      };

      const q = quark(initState, {
        mode: "queue",
        actions: {
          async *action1(api) {
            yield s => ({
              order: [...s.order, "action1:yield1"],
            });

            await sleep(20);

            yield s => ({
              order: [...s.order, "action1:yield2"],
            });

            await sleep(40);

            yield s => ({
              order: [...s.order, "action1:yield3"],
            });

            await sleep(60);

            return s => ({
              order: [...s.order, "action1:return"],
            });
          },
          async *action2(api) {
            await sleep(10);

            yield s => ({
              order: [...s.order, "action2:yield1"],
            });

            await sleep(30);

            yield s => ({
              order: [...s.order, "action2:yield2"],
            });

            await sleep(50);

            yield s => ({
              order: [...s.order, "action2:yield3"],
            });

            await sleep(70);

            return s => ({
              order: [...s.order, "action2:return"],
            });
          },
        },
      });

      await Promise.all([
        q.act.action1(),
        q.act.action2(),
      ]);

      expect(q.get()).toEqual({
        order: [
          "action1:yield1",
          "action1:yield2",
          "action1:yield3",
          "action1:return",
          "action2:yield1",
          "action2:yield2",
          "action2:yield3",
          "action2:return",
        ],
      });
    });

    it("set() correctly updates the state in queue mode", async () => {
      const q = quark({ value: 0 }, { mode: "queue" });

      expect(q.get().value).toBe(0);

      await act(async () => {
        q.set({ value: 5 });
      });

      expect(q.get().value).toBe(5);
    });

    it("set() correctly handles asynchronous updates in queue mode", async () => {
      const q = quark({ value: 0 }, { mode: "queue" });

      const promiseA = q.set(Promise.resolve({ value: 1 }));
      const promiseB = q.set(Promise.resolve({ value: 2 }));

      const setterBPromise = q.set(async () => {
        await sleep(10);
        return { value: 3 };
      });

      const setterAPromise = q.set(async () => {
        await sleep(5);
        return { value: 4 };
      });

      const promiseC = q.set(Promise.resolve({ value: 5 }));
      const promiseD = q.set(Promise.resolve({ value: 6 }));

      const setterCPromise = q.set(async () => {
        await sleep(15);
        return { value: 7 };
      });

      const setterDPromise = q.set(async () => {
        await sleep(1);
        return { value: 8 };
      });

      await Promise.all([
        promiseA,
        promiseB,
        setterBPromise,
        setterAPromise,
        promiseC,
        promiseD,
        setterCPromise,
        setterDPromise,
      ]);

      expect(q.get().value).toBe(8);
    });

    it("correctly executes custom actions in queue mode", async () => {
      const q = quark(
        { value: 0 },
        {
          mode: "queue",
          actions: {
            increment: (api) => {
              const newValue = api.get().value + 1;
              api.set({ value: newValue });
            },
            double: (api) => {
              const newValue = api.get().value * 2;
              api.set({ value: newValue });
            },
          },
        },
      );

      expect(q.get().value).toBe(0);

      await act(async () => {
        q.act.increment();
      });

      expect(q.get().value).toBe(1);

      await act(async () => {
        q.act.double();
      });

      expect(q.get().value).toBe(2);
    });

    it("correctly handles selectors in queue mode", async () => {
      type Q = { value1: number; value2: number };

      const q = quark(
        { value1: 0, value2: 10 } satisfies Q,
        {
          mode: "queue",
          actions: {
            SetVal1: (api, v: number) =>
              void api.set({ ...api.get(), value1: v }),
            SetVal2: (api, v: number) =>
              void api.set({ ...api.get(), value2: v }),
          },
          selectors: {
            selectV1: (s) => s.value1,
            selectV2: (s) => s.value2,
            selectSum: (s) => s.value1 + s.value2,
          },
        },
      );

      expect(q.select.selectV1()).toBe(0);
      expect(q.select.selectV2()).toBe(10);
      expect(q.select.selectSum()).toBe(10);
    });

    it("middleware correctly intercepts the values set in queue mode", async () => {
      const mapMiddleware = middleware<{ value: number }>({
        onValue(ctx) {
          if (typeof ctx.action === "object") {
            return ctx.next({ ...ctx.action, value: ctx.action.value * 2 });
          }
          return ctx.skip();
        },
      });

      const q = quark({ value: 1 }, {
        mode: "queue",
        middlewares: [mapMiddleware],
      });

      expect(q.get().value).toBe(2);

      await act(async () => {
        q.set({ value: 5 });
      });

      expect(q.get().value).toBe(10);

      await act(async () => {
        q.set((state) => ({ value: state.value + 3 }));
      });

      expect(q.get().value).toBe(26);
    });

    describe("correctly executes side effect in queue mode", () => {
      type Q = { value: number; derivedValue: string };

      const increment = (api: ActionApi<Q>) => {
        api.set({ value: api.get().value + 1, derivedValue: "" });
      };

      const deriveValue: QuarkCustomEffect<Q> = (prevState, current, set) => {
        set({ value: current.value, derivedValue: `${current.value}` });
      };

      it("when set() is called in queue mode", async () => {
        const q = quark(
          { value: 0, derivedValue: "0" } satisfies Q,
          {
            mode: "queue",
            actions: {
              increment,
            },
            effect: deriveValue,
          },
        );

        expect(q.get()).toEqual({ value: 0, derivedValue: "0" });

        await act(async () => {
          q.set({ value: 1, derivedValue: "0" });
        });

        expect(q.get()).toEqual({ value: 1, derivedValue: "1" });
      });

      it("when custom action is called in queue mode", async () => {
        const q = quark(
          { value: 0, derivedValue: "0" } satisfies Q,
          {
            mode: "queue",
            actions: {
              increment,
            },
            effect: deriveValue,
          },
        );

        expect(q.get()).toEqual({ value: 0, derivedValue: "0" });

        await act(async () => {
          q.act.increment();
        });

        expect(q.get()).toEqual({ value: 1, derivedValue: "1" });
      });

      it("with nested effects in queue mode", async () => {
        type Q2 = {
          value: number;
          derivedValue1: string;
          derivedValue2: string;
          derivedValue3: string;
        };

        const increment = (api: ActionApi<Q2>) => {
          api.set({
            value: api.get().value + 1,
            derivedValue1: "",
            derivedValue2: "",
            derivedValue3: "",
          });
        };

        const deriveValue: QuarkCustomEffect<Q2> = (
          prevState,
          current,
          set,
        ) => {
          set({
            value: current.value,
            derivedValue1: `${current.value}`,
            derivedValue2: `${2 * current.value}`,
            derivedValue3: `${3 * current.value}`,
          });
        };

        const q = quark(
          {
            value: 0,
            derivedValue1: "0",
            derivedValue2: "0",
            derivedValue3: "0",
          } satisfies Q2,
          {
            mode: "queue",
            actions: {
              increment,
            },
            effect: deriveValue,
          },
        );

        expect(q.get()).toEqual({
          value: 0,
          derivedValue1: "0",
          derivedValue2: "0",
          derivedValue3: "0",
        });

        await act(async () => {
          q.set({
            value: 1,
            derivedValue1: "0",
            derivedValue2: "0",
            derivedValue3: "0",
          });
        });

        expect(q.get().value).toBe(1);
        expect(q.get().derivedValue1).toBe("1");
        expect(q.get().derivedValue2).toBe("2");
        expect(q.get().derivedValue3).toBe("3");

        await act(async () => {
          q.set({
            value: 3,
            derivedValue1: "",
            derivedValue2: "",
            derivedValue3: "",
          });
        });

        expect(q.get().value).toBe(3);
        expect(q.get().derivedValue1).toBe("3");
        expect(q.get().derivedValue2).toBe("6");
        expect(q.get().derivedValue3).toBe("9");
      });
    });

    describe("correctly handles manual subscriptions in queue mode", () => {
      it("correctly calls the callback with the current state in queue mode", async () => {
        const q = quark({ value: 0 }, { mode: "queue" });

        const onSubOne = vitest.fn();
        const onSubTwo = vitest.fn();

        const subOne = q.subscribe(s => onSubOne(s));
        const subTwo = q.subscribe(s => onSubTwo(s));

        q.set({ value: 1 });

        await sleep(0);

        expect(onSubOne).toHaveBeenCalledTimes(1);
        expect(onSubOne).toHaveBeenLastCalledWith({ value: 1 });
        expect(onSubTwo).toHaveBeenCalledTimes(1);
        expect(onSubTwo).toHaveBeenLastCalledWith({ value: 1 });

        subOne.cancel();
        subTwo.cancel();
      });

      it("correctly cancels the subscription in queue mode", async () => {
        const q = quark({ value: 0 }, { mode: "queue" });

        const onSubOne = vitest.fn();
        const onSubTwo = vitest.fn();

        const subOne = q.subscribe(s => onSubOne(s));
        const subTwo = q.subscribe(s => onSubTwo(s));

        await act(async () => {
          q.set({ value: 1 });
        });

        expect(onSubOne).toHaveBeenCalledTimes(1);
        expect(onSubTwo).toHaveBeenCalledTimes(1);

        subOne.cancel();

        await act(async () => {
          q.set({ value: 2 });
        });

        expect(onSubOne).toHaveBeenCalledTimes(1);
        expect(onSubTwo).toHaveBeenCalledTimes(2);

        subTwo.cancel();
      });
    });

    describe("custom actions in queue mode", () => {
      it("applies updates in order even if a newer update has been dispatched in queue mode", async () => {
        const q = quark(
          { value: 0 },
          {
            mode: "queue",
            actions: {
              increment: (api) => void api.set({ value: api.get().value + 1 }),
              increment2: (api) => void api.set({ value: api.get().value + 2 }),
            },
          },
        );

        expect(q.get().value).toBe(0);

        await act(async () => {
          q.act.increment();
        });

        expect(q.get().value).toBe(1);

        await act(async () => {
          q.act.increment2();
        });

        expect(q.get().value).toBe(3);
      });

      describe("dispatchNew() in queue mode", () => {
        it("behaves as if a separate action was dispatched from outside in queue mode", async () => {
          const q = quark(
            { value: 0 },
            {
              mode: "queue",
              actions: {
                increment: (api) => {
                  const newValue = api.get().value + 1;
                  api.set({ value: newValue });
                },
                increment2: (api) => {
                  const newValue = api.get().value + 2;
                  api.set({ value: newValue });
                },
                increment3: (api) => {
                  const newValue = api.get().value + 3;
                  api.dispatchNew((api2) => void api2.set({ value: newValue }));
                },
              },
            },
          );

          expect(q.get().value).toBe(0);

          await act(async () => {
            q.act.increment();
          });

          expect(q.get().value).toBe(1);

          await act(async () => {
            q.act.increment2();
          });

          expect(q.get().value).toBe(3);

          q.act.increment3();
          q.set({ value: q.get().value + 10 });

          expect(q.get().value).toBe(16);
        });

        it("can be given other action from `this` in queue mode", async () => {
          const q = quark(
            { value: 0 },
            {
              mode: "queue",
              actions: {
                increment(api) {
                  void api.set({ value: api.get().value + 1 });
                },
                increment2(api) {
                  void api.set({ value: api.get().value + 2 });
                },
                dispatchIncrement(api) {
                  api.dispatchNew(this.increment);
                },
              },
            },
          );

          expect(q.get().value).toBe(0);

          await act(async () => {
            q.act.dispatchIncrement();
          });

          expect(q.get().value).toBe(1);
        });
      });

      describe("unsafeSet() in queue mode", () => {
        it("should update the state even if the current action was cancelled in queue mode", async () => {
          const p = controlledPromise();

          const q = quark(
            { value: 2 },
            {
              mode: "queue",
              actions: {
                increment: async (api) => {
                  await p.promise;
                  api.set({
                    value: api.get().value + 1,
                  });
                },
              },
            },
          );

          q.act.increment();

          expect(q.get()).toEqual({ value: 2 });

          q.unsafeSet({ value: 10 });

          expect(q.get()).toEqual({ value: 10 });

          p.resolve();
          await sleep(0);

          expect(q.get()).toEqual({ value: 11 });
        });
      });
    });

    describe("custom selectors in queue mode", () => {
      it("correctly handle arguments in queue mode", async () => {
        const q = quark(
          { value1: 3, value2: 10 },
          {
            mode: "queue",
            actions: {
              SetVal1: (api, v: number) =>
                void api.set({ ...api.get(), value1: v }),
              SetVal2: (api, v: number) =>
                void api.set({ ...api.get(), value2: v }),
            },
            selectors: {
              v: (s) => s,
              multipliedBy: (s, m: number) => s.value1 * m,
            },
          },
        );

        const v = q.select.v();
        expect(v).toEqual({ value1: 3, value2: 10 });

        const multipliedBy = q.select.multipliedBy(5);
        expect(multipliedBy).toBe(15);
      });
    });

    describe("procedures in queue mode", () => {
      it("correctly update the state with yielded values in queue mode", async () => {
        const p = controlledPromise<{ value: number }>();

        const q = quark(
          { inProgress: false, value: 2 },
          {
            mode: "queue",
            actions: {
              async *runProcedure(api) {
                yield { ...api.get(), inProgress: true };
                const newValue = await p.promise;
                return { inProgress: false, value: newValue.value };
              },
            },
          },
        );

        expect(q.get()).toEqual({ inProgress: false, value: 2 });

        await act(async () => {
          q.act.runProcedure();
          await sleep(0);
        });

        expect(q.get()).toEqual({ inProgress: true, value: 2 });

        await act(async () => {
          p.resolve({ value: 5 });
          await sleep(0);
        });

        expect(q.get()).toEqual({ inProgress: false, value: 5 });
      });

      it("correctly update the state with yielded fn setters in queue mode", async () => {
        const p = controlledPromise<{ value: number }>();

        const q = quark(
          { inProgress: false, value: 2 },
          {
            mode: "queue",
            actions: {
              async *runProcedure() {
                yield (current) => ({ ...current, inProgress: true });
                const newValue = await p.promise;
                return () => ({ inProgress: false, value: newValue.value });
              },
            },
          },
        );

        expect(q.get()).toEqual({ inProgress: false, value: 2 });

        await act(async () => {
          q.act.runProcedure();
          await sleep(0);
        });

        expect(q.get()).toEqual({ inProgress: true, value: 2 });

        await act(async () => {
          p.resolve({ value: 5 });
          await sleep(0);
        });

        expect(q.get()).toEqual({ inProgress: false, value: 5 });
      });

      it("correctly update the state with yielded fn setters and immer in queue mode", async () => {
        const p = controlledPromise<{ value: number }>();

        const q = quark(
          { inProgress: false, value: 20 },
          {
            mode: "queue",
            middlewares: [createImmerMiddleware()],
            actions: {
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

        expect(q.get()).toEqual({ inProgress: false, value: 20 });

        await act(async () => {
          q.act.runProcedure();
          await sleep(0);
        });

        expect(q.get()).toEqual({ inProgress: true, value: 20 });

        await act(async () => {
          p.resolve({ value: 1234 });
          await sleep(0);
        });

        expect(q.get()).toEqual({ inProgress: false, value: 1234 });
      });

      it("applies all yielded values in order in queue mode when another state update happens", async () => {
        const p1 = controlledPromise<{ value: number }>();
        const p2 = controlledPromise<{ value: number }>();

        const q = quark(
          { inProgress: false, value: 2 },
          {
            mode: "queue",
            actions: {
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

        expect(q.get()).toEqual({ inProgress: false, value: 2 });

        await act(async () => {
          q.act.runProcedure();
          await sleep(0);
        });

        expect(q.get()).toEqual({ inProgress: true, value: 0 });

        await act(async () => {
          p1.resolve({ value: 10 });
          await sleep(0);
        });

        expect(q.get()).toEqual({ inProgress: true, value: 10 });

        await act(async () => {
          q.set({ inProgress: false, value: 15 });
        });

        expect(q.get()).toEqual({ inProgress: true, value: 10 });

        await act(async () => {
          p2.resolve({ value: 20 });
          await sleep(0);
        });

        expect(q.get().value).toBe(15);
      });

      it("applies all yielded values in order in queue mode when an async state update happens", async () => {
        const p1 = controlledPromise<{ value: number }>();
        const p2 = controlledPromise<{ value: number }>();

        const q = quark(
          { inProgress: false, value: 2 },
          {
            mode: "queue",
            actions: {
              async *runProcedure() {
                yield { inProgress: true, value: 0 };
                const newValue = await p1.promise;
                yield { inProgress: true, value: newValue.value };
                const newValue2 = await p2.promise;
                return { inProgress: false, value: newValue2.value };
              },
              async fetchValue(api) {
                await sleep(0);
                api.set({ value: 100, inProgress: false });
              },
            },
          },
        );

        expect(q.get()).toEqual({ inProgress: false, value: 2 });

        await act(async () => {
          q.act.runProcedure();
          await sleep(0);
        });

        expect(q.get()).toEqual({ inProgress: true, value: 0 });

        let fetchValue: any;
        await act(async () => {
          fetchValue = q.act.fetchValue();
          await sleep(0);
        });

        expect(q.get()).toEqual({ inProgress: true, value: 0 });

        await act(async () => {
          await p1.resolve({ value: 10 });
          await sleep(0);
        });

        expect(q.get()).toEqual({ inProgress: true, value: 10 });

        await act(async () => {
          await p2.resolve({ value: 20 });
          await fetchValue;
        });

        // In queue mode, all updates are applied in order
        expect(q.get()).toEqual({ inProgress: false, value: 100 });
      });
    });
  });
});
