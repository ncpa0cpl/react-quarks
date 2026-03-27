import { act, renderHook } from "@testing-library/react-hooks";
import { describe, expect, it } from "vitest";
import {
  collection,
  composeSelectors,
  createImmerMiddleware,
  quark,
  QuarkType,
  SetStateAction,
} from "../src";
import { controlledPromise, sleep } from "./helpers";

describe("Quark Collection", () => {
  it("get and selectors return correct values", () => {
    const text = quark("");
    const number = quark(0);
    const object = quark({
      foo: 1,
      bar: "2",
      baz: ["a", "b"],
    });

    const c = collection({ text, number, object }, {
      mode: "queue",
      actions: {
        action(api, n: number, t: string) {
          api.number.set(n);
          api.text.set(t);
        },
      },
      selectors: {
        boxed(state) {
          return { state };
        },
        baz(s) {
          return s.object.baz;
        },
        complex: composeSelectors(
          s => s.number,
          s => s.text,
          s => s.object.baz,
          s => s.object.bar,
          (n, t, bz, br) => ({
            n,
            t,
            bz,
            br,
          }),
        ),
      },
    });

    expect(c.get()).toEqual({
      text: "",
      number: 0,
      object: {
        foo: 1,
        bar: "2",
        baz: ["a", "b"],
      },
    });

    expect(c.select.boxed()).toEqual({
      state: {
        text: "",
        number: 0,
        object: {
          foo: 1,
          bar: "2",
          baz: ["a", "b"],
        },
      },
    });

    expect(c.select.baz()).toEqual(["a", "b"]);

    expect(c.select.complex()).toEqual({
      n: 0,
      t: "",
      bz: ["a", "b"],
      br: "2",
    });
  });

  it("basic actions work", () => {
    const text = quark("lorem ipsum");
    const number = quark(255);
    const object = quark({
      box: { value: 1 },
      array: [1, "2", null],
    });

    const c = collection({ text, number, object }, {
      mode: "queue",
      actions: {
        setBoxV(api, value: number) {
          api.object.set(ob => ({ ...ob, box: { value } }));
        },
        setNumber(api, v: number) {
          api.number.set(v);
        },
        setAll(
          api,
          text: string,
          number: number,
          boxValue: number,
          array: Array<string | number | null>,
        ) {
          api.text.set(text);
          api.number.set(number);
          api.object.set({
            array,
            box: { value: boxValue },
          });
        },
      },
    });

    expect(c.get()).toEqual({
      text: "lorem ipsum",
      number: 255,
      object: {
        box: { value: 1 },
        array: [1, "2", null],
      },
    });

    c.act.setNumber(-5);

    expect(number.get()).toEqual(-5);
    expect(c.get()).toEqual({
      text: "lorem ipsum",
      number: -5,
      object: {
        box: { value: 1 },
        array: [1, "2", null],
      },
    });

    c.act.setBoxV(69);

    expect(object.get().box.value).toEqual(69);
    expect(c.get()).toEqual({
      text: "lorem ipsum",
      number: -5,
      object: {
        box: { value: 69 },
        array: [1, "2", null],
      },
    });

    c.act.setAll("bopity", -420, 1001, [4, "2", 0, "6", 9]);

    expect(number.get()).toEqual(-420);
    expect(text.get()).toEqual("bopity");
    expect(object.get().box.value).toEqual(1001);
    expect(object.get().array).toEqual([4, "2", 0, "6", 9]);
    expect(c.get()).toEqual({
      text: "bopity",
      number: -420,
      object: {
        box: { value: 1001 },
        array: [4, "2", 0, "6", 9],
      },
    });
  });

  it("actions with complex dispatches", async () => {
    const list = quark([{ v: 1 }, { v: 2 }, { v: 3 }]);
    const flatObj = quark({ foo: "abc", bar: "123", baz: { value: "value" } });

    const c = collection({ list, flatObj }, {
      mode: "queue",
      actions: {
        asyncListSet(api) {
          api.list.set(sleep(5).then(() => [{ v: 10 }, { v: 29 }]));
        },
        multiAsync(api) {
          api.list.set(sleep(5).then(() => [{ v: 69 }]));
          api.flatObj.set(
            sleep(2).then(() => ({
              foo: "def",
              bar: "456",
              baz: { value: "value" },
            })),
          );
        },
        asyncWithFunc(api) {
          api.flatObj.set(
            sleep(2).then(() => (o) => ({
              foo: o.foo,
              bar: "000",
              baz: o.baz,
            })),
          );
        },
        withAssign(api) {
          api.flatObj.assign({ foo: "xyz" });
        },
        withSelectAssign(api) {
          api.flatObj.assign(s => s.baz, { value: "010101" });
        },
      },
    });

    expect(c.get()).toEqual({
      list: [{ v: 1 }, { v: 2 }, { v: 3 }],
      flatObj: { foo: "abc", bar: "123", baz: { value: "value" } },
    });

    await c.act.asyncListSet();

    expect(c.get()).toEqual({
      list: [{ v: 10 }, { v: 29 }],
      flatObj: { foo: "abc", bar: "123", baz: { value: "value" } },
    });

    await c.act.multiAsync();

    expect(c.get()).toEqual({
      list: [{ v: 69 }],
      flatObj: {
        foo: "def",
        bar: "456",
        baz: { value: "value" },
      },
    });

    await c.act.asyncWithFunc();

    expect(c.get()).toEqual({
      list: [{ v: 69 }],
      flatObj: {
        foo: "def",
        bar: "000",
        baz: { value: "value" },
      },
    });

    c.act.withAssign();

    expect(c.get()).toEqual({
      list: [{ v: 69 }],
      flatObj: {
        foo: "xyz",
        bar: "000",
        baz: { value: "value" },
      },
    });

    c.act.withSelectAssign();

    expect(c.get()).toEqual({
      list: [{ v: 69 }],
      flatObj: {
        foo: "xyz",
        bar: "000",
        baz: { value: "010101" },
      },
    });
  });

  describe("in react", () => {
    it("returns the selected values", () => {
      const text = quark("");
      const number = quark(0);
      const object = quark({
        foo: 1,
        bar: "2",
        baz: ["a", "b"],
      });

      const c = collection({ text, number, object }, {
        mode: "queue",
        actions: {
          action(api, n: number, t: string) {
            api.number.set(n);
            api.text.set(t);
          },
        },
        selectors: {
          boxed(state) {
            return { state };
          },
          baz(s) {
            return s.object.baz;
          },
          complex: composeSelectors(
            s => s.number,
            s => s.text,
            s => s.object.baz,
            s => s.object.bar,
            (n, t, bz, br) => ({
              n,
              t,
              bz,
              br,
            }),
          ),
        },
      });

      const state = renderHook(() => c.use());
      const box = renderHook(() => c.select.useBoxed());
      const baz = renderHook(() => c.select.useBaz());
      const complex = renderHook(() => c.select.useComplex());

      expect(state.result.current.value).toEqual({
        text: "",
        number: 0,
        object: {
          foo: 1,
          bar: "2",
          baz: ["a", "b"],
        },
      });

      expect(box.result.current).toEqual({
        state: {
          text: "",
          number: 0,
          object: {
            foo: 1,
            bar: "2",
            baz: ["a", "b"],
          },
        },
      });

      expect(baz.result.current).toEqual(["a", "b"]);

      expect(complex.result.current).toEqual({
        n: 0,
        t: "",
        bz: ["a", "b"],
        br: "2",
      });
    });

    it("use() rerenders the components on any quark change", async () => {
      const text = quark("");
      const number = quark(0);
      const object = quark({
        foo: 1,
        bar: "2",
        baz: ["a", "b"],
      });

      const c = collection({ text, number, object }, {
        mode: "queue",
        actions: {
          action(api, n: number, t: string) {
            api.number.set(n);
            api.text.set(t);
          },
        },
      });

      let renderCount = 0;
      const state = renderHook(() => {
        renderCount++;
        return c.use();
      });

      expect(renderCount).toBe(1);
      expect(state.result.current.value).toEqual({
        text: "",
        number: 0,
        object: {
          foo: 1,
          bar: "2",
          baz: ["a", "b"],
        },
      });

      act(() => {
        state.result.current.action(-999, "AAAAAAA");
      });

      await state.waitFor(() =>
        expect(state.result.current.value).toEqual({
          text: "AAAAAAA",
          number: -999,
          object: {
            foo: 1,
            bar: "2",
            baz: ["a", "b"],
          },
        })
      );
      expect(renderCount).toBe(2);

      act(() => {
        text.set("hola");
      });

      await state.waitFor(() =>
        expect(state.result.current.value).toEqual({
          text: "hola",
          number: -999,
          object: {
            foo: 1,
            bar: "2",
            baz: ["a", "b"],
          },
        })
      );
      expect(renderCount).toBe(3);

      act(() => {
        object.assign({ bar: "RABARBAR" });
      });

      await state.waitFor(() =>
        expect(state.result.current.value).toEqual({
          text: "hola",
          number: -999,
          object: {
            foo: 1,
            bar: "RABARBAR",
            baz: ["a", "b"],
          },
        })
      );
      expect(renderCount).toBe(4);

      act(() => {
        text.set("lorem ipsum");
        number.set(5555);
        object.assign({ foo: 0 });
      });

      await state.waitFor(() =>
        expect(state.result.current.value).toEqual({
          text: "lorem ipsum",
          number: 5555,
          object: {
            foo: 0,
            bar: "RABARBAR",
            baz: ["a", "b"],
          },
        })
      );
      expect(renderCount).toBe(5);
    });

    it("selectors rerenders the components on selected value change", async () => {
      const text = quark("init");
      const number = quark(0);
      const object = quark({
        foo: 1,
        bar: "2",
        baz: ["a", "b"],
      });

      const c = collection({ text, number, object }, {
        selectors: {
          foo(s) {
            return s.object.foo;
          },
          lastBaz(s) {
            // @ts-ignore
            return s.object.baz.at(-1) as string;
          },
          textAndBar: composeSelectors(
            s => s.text,
            s => s.object.bar,
            (t, bt) => ({
              barText: bt,
              mainText: t,
            }),
          ),
        },
      });

      let fooRenderCount = 0;
      const fooState = renderHook(() => {
        fooRenderCount++;
        return c.select.useFoo();
      });

      expect(fooRenderCount).toBe(1);
      expect(fooState.result.current).toEqual(1);

      act(() => {
        c.set(api => {
          api.object.assign({ foo: 19 });
        });
      });

      await fooState.waitFor(() => expect(fooState.result.current).toEqual(19));
      expect(fooRenderCount).toBe(2);

      fooState.unmount();

      act(() => {
        c.set(api => {
          api.object.assign({ bar: "qwfaefg" });
        });
      });

      await sleep(10);
      expect(fooRenderCount).toBe(2);

      let lastBazRenderCount = 0;
      const lastBazState = renderHook(() => {
        lastBazRenderCount++;
        return c.select.useLastBaz();
      });

      expect(lastBazRenderCount).toBe(1);
      expect(lastBazState.result.current).toEqual("b");

      act(() => {
        c.set(api => {
          api.object.assign({ baz: ["foobar"] });
        });
      });

      await lastBazState.waitFor(() =>
        expect(lastBazState.result.current).toEqual("foobar")
      );
      expect(lastBazRenderCount).toBe(2);

      act(() => {
        c.set(api => {
          api.object.assign({ bar: "97654" });
        });
      });

      await sleep(10);
      expect(lastBazRenderCount).toBe(2);
      lastBazState.unmount();

      let textAndBarRenderCount = 0;
      const textAndBarBazState = renderHook(() => {
        textAndBarRenderCount++;
        return c.select.useTextAndBar();
      });

      expect(textAndBarRenderCount).toBe(1);
      expect(textAndBarBazState.result.current).toEqual({
        barText: "97654",
        mainText: "init",
      });

      act(() => {
        text.set("updated");
      });

      await textAndBarBazState.waitFor(() =>
        expect(textAndBarBazState.result.current).toEqual({
          barText: "97654",
          mainText: "updated",
        })
      );
      expect(textAndBarRenderCount).toBe(2);

      act(() => {
        object.assign({ bar: "090909" });
      });

      await textAndBarBazState.waitFor(() =>
        expect(textAndBarBazState.result.current).toEqual({
          barText: "090909",
          mainText: "updated",
        })
      );
      expect(textAndBarRenderCount).toBe(3);

      act(() => {
        object.assign({ bar: "byebye" });
        c.set(api => {
          api.text.set("hello world");
        });
      });

      await textAndBarBazState.waitFor(() =>
        expect(textAndBarBazState.result.current).toEqual({
          barText: "byebye",
          mainText: "hello world",
        })
      );
      expect(textAndBarRenderCount).toBe(4);

      act(() => {
        c.set(api => {
          api.object.assign({ foo: 13221 });
        });
      });

      await sleep(10);
      expect(textAndBarRenderCount).toBe(4);

      act(() => {
        number.set(12345656778);
      });

      await sleep(10);
      expect(textAndBarRenderCount).toBe(4);
      textAndBarBazState.unmount();
    });
  });

  describe("collection modes", () => {
    describe("queue mode", () => {
      it("queues collection actions and executes them in order", async () => {
        const q1 = quark({ value: 0, order: [] as string[] });
        const q2 = quark({ value: "", order: [] as string[] });

        const c = collection({ q1, q2 }, {
          mode: "queue",
          actions: {
            async action1(api, delay: number) {
              await sleep(delay);
              api.q1.set(s => ({
                value: s.value + 1,
                order: [...s.order, "action1-q1"],
              }));
              api.q2.set(s => ({
                value: s.value + "a",
                order: [...s.order, "action1-q2"],
              }));
            },
            async action2(api, delay: number) {
              await sleep(delay);
              api.q1.set(s => ({
                value: s.value + 10,
                order: [...s.order, "action2-q1"],
              }));
              api.q2.set(s => ({
                value: s.value + "b",
                order: [...s.order, "action2-q2"],
              }));
            },
          },
        });

        await Promise.all([
          c.act.action1(30),
          c.act.action2(10),
        ]);

        expect(c.get().q1.value).toBe(11);
        expect(c.get().q2.value).toBe("ab");
        expect(c.get().q1.order).toEqual([
          "action1-q1",
          "action2-q1",
        ]);
        expect(c.get().q2.order).toEqual([
          "action1-q2",
          "action2-q2",
        ]);
      });

      it("queues async updates with promises", async () => {
        const counter = quark(0);
        const text = quark("");

        const c = collection({ counter, text }, {
          mode: "queue",
          actions: {
            async updateBoth(
              api,
              counterVal: number,
              textVal: string,
              delay: number,
            ) {
              await sleep(delay);
              api.counter.set(counterVal);
              api.text.set(textVal);
            },
          },
        });

        await Promise.all([
          c.act.updateBoth(1, "first", 30),
          c.act.updateBoth(2, "second", 10),
          c.act.updateBoth(3, "third", 20),
        ]);

        expect(c.get().counter).toBe(3);
        expect(c.get().text).toBe("third");
      });

      it("individual quark actions within a collection action count as single action", async () => {
        const q = quark({ value: 0 }, { mode: "queue" });

        const c = collection({ q }, {
          mode: "queue",
          actions: {
            async multiUpdate(api) {
              api.q.set(s => ({ value: s.value + 1 }));
              api.q.set(s => ({ value: s.value + 1 }));
              api.q.set(s => ({ value: s.value + 1 }));
              await sleep(10);
              api.q.set(s => ({ value: s.value + 10 }));
            },
          },
        });

        const p1 = c.act.multiUpdate();
        const p2 = c.act.multiUpdate();

        await Promise.all([p1, p2]);

        expect(c.get().q.value).toBe(26);
      });

      it("queued collection actions wait for previous async quark updates", async () => {
        const q = quark({ value: 0, updates: [] as number[] });

        const c = collection({ q }, {
          mode: "queue",
          actions: {
            async asyncSet(api, value: number, delay: number) {
              await sleep(delay);
              api.q.set(s => ({ ...s, value, updates: [...s.updates, value] }));
            },
          },
        });

        await Promise.all([
          c.act.asyncSet(1, 30),
          c.act.asyncSet(2, 10),
          c.act.asyncSet(3, 20),
        ]);

        expect(c.get().q.updates).toEqual([1, 2, 3]);
        expect(c.get().q.value).toBe(3);
      });

      it("queued collection actions wait for individual quark updates", async () => {
        const q1 = quark({ value: 0, updates: [] as number[] });
        const q2 = quark({ value: 0, updates: [] as number[] });

        type T = QuarkType<typeof q1>;

        const c = collection({ q1, q2 }, {
          mode: "queue",
          actions: {
            async asyncSetBoth(api, value: number, delay: number) {
              await sleep(delay);
              api.q2.set(s => ({
                ...s,
                value,
                updates: [...s.updates, value],
              }));
              api.q1.set(s => ({
                ...s,
                value,
                updates: [...s.updates, value],
              }));
            },
          },
        });

        const p1 = controlledPromise<number>();
        const p2 = controlledPromise<number>();
        const p3 = controlledPromise<number>();

        q1.set(p1.promise.then((num): SetStateAction<T> => {
          return (state) => ({
            value: num,
            updates: [...state.updates, num],
          });
        }));

        q2.set(p2.promise.then((num): SetStateAction<T> => {
          return (state) => ({
            value: num,
            updates: [...state.updates, num],
          });
        }));

        const act1 = c.act.asyncSetBoth(1, 30);
        const act2 = c.act.asyncSetBoth(2, 10);
        const act3 = c.act.asyncSetBoth(3, 20);

        q1.set(p3.promise.then((num): SetStateAction<T> => {
          return (state) => ({
            value: num,
            updates: [...state.updates, num],
          });
        }));

        await sleep(50);

        expect(c.get().q1.updates).toEqual([]);
        expect(c.get().q1.value).toBe(0);

        expect(c.get().q2.updates).toEqual([]);
        expect(c.get().q2.value).toBe(0);

        p3.resolve(102);
        await p2.resolve(99);

        expect(c.get().q1.updates).toEqual([]);
        expect(c.get().q1.value).toBe(0);

        expect(c.get().q2.updates).toEqual([99]);
        expect(c.get().q2.value).toBe(99);

        await p1.resolve(-47);

        expect(c.get().q1.updates).toEqual([-47]);
        expect(c.get().q1.value).toBe(-47);

        expect(c.get().q2.updates).toEqual([99]);
        expect(c.get().q2.value).toBe(99);

        await Promise.all([act1, act2, act3, p3.promise]);

        expect(c.get().q1.updates).toEqual([-47, 1, 2, 3, 102]);
        expect(c.get().q1.value).toBe(102);

        expect(c.get().q2.updates).toEqual([99, 1, 2, 3]);
        expect(c.get().q2.value).toBe(3);
      });
    });

    describe("cancel mode", () => {
      it("cancels previous collection actions when new one is dispatched", async () => {
        const q1 = quark({ value: 0, canceled: false });
        const q2 = quark({ value: "", canceled: false });

        const c = collection({ q1, q2 }, {
          mode: "cancel",
          actions: {
            async action1(api) {
              api.q1.set({ value: 1, canceled: false });
              api.q2.set({ value: "a", canceled: false });
              await sleep(50);
              api.q1.set({ value: 10, canceled: false });
              api.q2.set({ value: "aa", canceled: false });
            },
            async action2(api) {
              api.q1.set({ value: 2, canceled: false });
              api.q2.set({ value: "b", canceled: false });
              await sleep(10);
              api.q1.set({ value: 20, canceled: false });
              api.q2.set({ value: "bb", canceled: false });
            },
          },
        });

        c.act.action1();
        await sleep(5);
        await c.act.action2();

        expect(c.get().q1.value).toBe(20);
        expect(c.get().q2.value).toBe("bb");
      });

      it("cancel mode ignores state updates from cancelled actions", async () => {
        const counter = quark(0);

        const c = collection({ counter }, {
          mode: "cancel",
          actions: {
            async incrementWithDelay(api, amount: number, delay: number) {
              api.counter.set(s => s + 1);
              await sleep(delay);
              api.counter.set(s => s + amount);
            },
          },
        });

        c.act.incrementWithDelay(100, 50);
        await sleep(10);
        await c.act.incrementWithDelay(10, 5);

        expect(c.get().counter).toBe(12);
      });

      it("isCanceled returns true for cancelled actions", async () => {
        const q = quark({ value: 0 });
        let wasCanceled = [0, false];

        const c = collection({ q }, {
          mode: "cancel",
          actions: {
            async checkCanceled(api, idx: number) {
              await sleep(30);
              if (api.isCanceled()) {
                wasCanceled = [idx, api.isCanceled()];
              }
            },
          },
        });

        c.act.checkCanceled(1);
        c.act.checkCanceled(2);

        await sleep(50);

        expect(wasCanceled).toEqual([1, true]);
      });
    });

    describe("none mode", () => {
      it("executes actions immediately without queuing or canceling", async () => {
        const q = quark({ values: <number[]> [] }, { mode: "none" });

        const c = collection({ q }, {
          mode: "none",
          actions: {
            async setValue(api, delay: number, val: number) {
              await sleep(delay);
              api.q.set({ values: [...api.q.get().values, val] });
            },
          },
        });

        await Promise.all([
          c.act.setValue(100, 1),
          c.act.setValue(25, 2),
          c.act.setValue(50, 3),
        ]);

        expect(c.get().q.values).toEqual([2, 3, 1]);
      });

      it("async actions in none still queue if the child quark is in queue mode", async () => {
        const order: string[] = [];
        const q = quark({ value: 0 }, { mode: "queue" });

        const c = collection({ q }, {
          mode: "none",
          actions: {
            async asyncAction(api, name: string, delay: number) {
              await sleep(delay);
              order.push(name);
              api.q.set({ value: order.length });
            },
          },
        });

        await Promise.all([
          c.act.asyncAction("first", 30),
          c.act.asyncAction("second", 10),
          c.act.asyncAction("third", 20),
        ]);

        expect(order).toEqual(["first", "second", "third"]);
      });
    });

    describe("race condition handling", () => {
      it("collection queue mode prevents race conditions with concurrent updates", async () => {
        const counter = quark([] as number[]);

        const c = collection({ list: counter }, {
          mode: "queue",
          actions: {
            async withRandomDelay(api, v: number) {
              await sleep(Math.random() * 20);
              api.list.set(c => [...c, v]);
            },
          },
        });

        const promises = [];
        for (let i = 0; i < 20; i++) {
          promises.push(c.act.withRandomDelay(i));
        }

        await Promise.all(promises);

        expect(c.get().list).toEqual([
          0,
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10,
          11,
          12,
          13,
          14,
          15,
          16,
          17,
          18,
          19,
        ]);
      });

      it("collection cancel mode ensures last update wins", async () => {
        const value = quark("");

        const c = collection({ value }, {
          mode: "cancel",
          actions: {
            async setValueWithDelay(api, val: string, delay: number) {
              await sleep(delay);
              api.value.set(val);
            },
          },
        });

        const promises = [];
        for (let i = 0; i < 10; i++) {
          promises.push(
            c.act.setValueWithDelay(`value-${i}`, Math.random() * 50),
          );
        }

        await Promise.all(promises);

        expect(c.get().value).toBe("value-9");
      });
    });

    describe("procedures in collections", () => {
      it("generator actions in queue mode execute yields in order", async () => {
        const q = quark({ values: [] as number[], inProgress: false });

        const c = collection({ q }, {
          mode: "queue",
          actions: {
            async *procedure(api) {
              yield api.q.set({
                values: [...api.q.get().values],
                inProgress: true,
              });

              await sleep(20);
              yield a =>
                a.q({
                  values: [...api.q.get().values, 1],
                  inProgress: true,
                });

              await sleep(10);
              yield api.q.set({
                values: [...api.q.get().values, 2],
                inProgress: true,
              });

              return a =>
                a.q({
                  values: [...api.q.get().values, 3],
                  inProgress: false,
                });
            },
          },
        });

        const p = c.act.procedure();
        await sleep(10);

        expect(c.get().q.values).toEqual([]);
        expect(c.get().q.inProgress).toBe(true);

        await p;

        expect(c.get().q.values).toEqual([1, 2, 3]);
        expect(c.get().q.inProgress).toBe(false);
      });

      it("generator actions in cancel mode stop on cancellation", async () => {
        const q = quark({ values: [] as number[] });

        const c = collection({ q }, {
          mode: "cancel",
          actions: {
            async *procedure(api) {
              yield api.q.set({ values: [...api.q.get().values, 1] });
              await sleep(30);
              yield a => a.q({ values: [...api.q.get().values, 2] });
              await sleep(30);
              yield api.q.set({ values: [...api.q.get().values, 3] });
              return a => a.q({ values: [...api.q.get().values, 4] });
            },
          },
        });

        c.act.procedure();
        await sleep(10);
        c.set(c => c.q.set(q => ({ values: [...q.values, 123] })));

        await sleep(100);

        expect(c.get().q.values).toEqual([1, 123]);
      });

      it("generator actions with multiple quarks", async () => {
        const q1 = quark("hello");
        const q2 = quark(1500100900);
        const q3 = quark(["a", "b", "c"]);
        const q4 = quark({ procedureInProgress: false });

        const p1 = controlledPromise();
        const p2 = controlledPromise();
        const p3 = controlledPromise();

        const c = collection({ q1, q2, q3, q4 }, {
          mode: "queue",
          actions: {
            async *prcdr1(api, q1: string, q2: number) {
              yield api.q4.assign({ procedureInProgress: true });

              await p1.promise;
              yield api.q1.set(q1);

              await p2.promise;
              yield a => a.q2(q2);

              return a => a.q4({ procedureInProgress: false });
            },
            async *prcdr2(api, ...v: Promise<string>[]) {
              yield a => a.q4({ procedureInProgress: true });

              for (const next of v) {
                const n = await next;
                yield api.q3.set(q3 => [...q3, n]);
              }

              await p3.promise;

              return api.q4.assign({ procedureInProgress: false });
            },
            async *prcdr3(api) {
              yield api.q1.set("");
              yield api.q2.set(0);
              yield api.q3.set([]);
              return api.noop();
            },
          },
        });

        const procedure = c.act.prcdr1("first call", 999);

        await sleep(50);

        expect(q1.get()).toEqual("hello");
        expect(q2.get()).toEqual(1500100900);
        expect(q3.get()).toEqual(["a", "b", "c"]);
        expect(q4.get().procedureInProgress).toEqual(true);

        await p1.resolve();

        expect(q1.get()).toEqual("first call");
        expect(q2.get()).toEqual(1500100900);
        expect(q3.get()).toEqual(["a", "b", "c"]);
        expect(q4.get().procedureInProgress).toEqual(true);

        await p2.resolve();

        expect(q1.get()).toEqual("first call");
        expect(q2.get()).toEqual(999);
        expect(q3.get()).toEqual(["a", "b", "c"]);
        expect(q4.get().procedureInProgress).toEqual(true);

        await procedure;
        expect(q4.get().procedureInProgress).toEqual(false);

        const s1p = controlledPromise<string>();
        const s2p = controlledPromise<string>();
        const s3p = controlledPromise<string>();

        const procd2 = c.act.prcdr2(s1p.promise, s2p.promise, s3p.promise);
        const procd3 = c.act.prcdr3();

        await sleep(1);

        expect(q1.get()).toEqual("first call");
        expect(q2.get()).toEqual(999);
        expect(q3.get()).toEqual(["a", "b", "c"]);
        expect(q4.get().procedureInProgress).toEqual(true);

        await s1p.resolve("s1p");

        expect(q1.get()).toEqual("first call");
        expect(q2.get()).toEqual(999);
        expect(q3.get()).toEqual(["a", "b", "c", "s1p"]);
        expect(q4.get().procedureInProgress).toEqual(true);

        await s2p.resolve("s2p");

        expect(q1.get()).toEqual("first call");
        expect(q2.get()).toEqual(999);
        expect(q3.get()).toEqual(["a", "b", "c", "s1p", "s2p"]);
        expect(q4.get().procedureInProgress).toEqual(true);

        await s3p.resolve("s3p");

        expect(q1.get()).toEqual("first call");
        expect(q2.get()).toEqual(999);
        expect(q3.get()).toEqual(["a", "b", "c", "s1p", "s2p", "s3p"]);
        expect(q4.get().procedureInProgress).toEqual(true);

        p3.resolve();
        await procd2;
        await procd3;

        expect(q1.get()).toEqual("");
        expect(q2.get()).toEqual(0);
        expect(q3.get()).toEqual([]);
        expect(q4.get().procedureInProgress).toEqual(false);
      });

      it("generator actions with complex dispatch actions", async () => {
        const q1 = quark({ foo: 1, bar: "2" });
        const q2 = quark({ list: [1, 2, 3] });
        const q3 = quark({
          data: { box: { value1: "value1", value2: "value2" } },
        });

        const c = collection({ q1, q2, q3 }, {
          mode: "queue",
          actions: {
            async *prcdr1(api) {
              yield api.q3.set(
                Promise.resolve("newV2").then((newV2) => state => ({
                  data: {
                    box: { value2: newV2, value1: state.data.box.value1 },
                  },
                })),
              );
              return api.noop();
            },
            async *prcdr2(api) {
              yield api.q2.set(
                (s) =>
                  Promise.resolve([4, 5]).then(
                    l => ({ list: [...s.list, ...l] }),
                  ),
              );
              return api.noop();
            },
            async *prcdr3(api) {
              yield api.q1.set(
                () =>
                  Promise.resolve("hello world").then(
                    str => state => ({ foo: state.foo, bar: str }),
                  ),
              );
              yield api.q2.set(
                () => ({ list: [0, 1, 0] }),
              );
              yield api.q3.set(
                (s) => ({
                  data: { box: { value1: "VvVvV", value2: s.data.box.value2 } },
                }),
              );
              return api.noop();
            },
          },
        });

        expect(c.get()).toEqual({
          q1: { foo: 1, bar: "2" },
          q2: { list: [1, 2, 3] },
          q3: {
            data: { box: { value1: "value1", value2: "value2" } },
          },
        });

        await c.act.prcdr1();

        expect(c.get()).toEqual({
          q1: { foo: 1, bar: "2" },
          q2: { list: [1, 2, 3] },
          q3: {
            data: { box: { value1: "value1", value2: "newV2" } },
          },
        });
        expect(q3.get()).toEqual({
          data: { box: { value1: "value1", value2: "newV2" } },
        });

        await c.act.prcdr2();

        expect(c.get()).toEqual({
          q1: { foo: 1, bar: "2" },
          q2: { list: [1, 2, 3, 4, 5] },
          q3: {
            data: { box: { value1: "value1", value2: "newV2" } },
          },
        });
        expect(q2.get()).toEqual({ list: [1, 2, 3, 4, 5] });

        await c.act.prcdr3();

        expect(c.get()).toEqual({
          q1: { foo: 1, bar: "hello world" },
          q2: { list: [0, 1, 0] },
          q3: {
            data: { box: { value1: "VvVvV", value2: "newV2" } },
          },
        });
        expect(q1.get()).toEqual({ foo: 1, bar: "hello world" });
        expect(q2.get()).toEqual({ list: [0, 1, 0] });
        expect(q3.get()).toEqual({
          data: { box: { value1: "VvVvV", value2: "newV2" } },
        });
      });
    });
  });

  describe("immer middleware", () => {
    it("action can mutate in place the drafts provided to the setter functions", async () => {
      const q1 = quark({ foo: 1, box: { bar: "hello", list: [1, 23, 56] } }, {
        middlewares: [createImmerMiddleware()],
      });
      const q2 = quark({ foo: 1, box: { bar: "hello", list: [1, 23, 56] } }, {
        middlewares: [createImmerMiddleware()],
      });

      const c = collection({ q1, q2 }, {
        mode: "queue",
        actions: {
          updateBoth(api) {
            api.q1.set(draft => {
              draft.foo = 10;
              draft.box.bar = "world";
              draft.box.list.push(100);
              return draft;
            });
            api.q2.set(draft => {
              draft.foo = 20;
              draft.box.bar = "updated";
              draft.box.list[0] = 999;
              return draft;
            });
          },
        },
      });

      c.act.updateBoth();

      expect(q1.get()).toEqual({
        foo: 10,
        box: { bar: "world", list: [1, 23, 56, 100] },
      });
      expect(q2.get()).toEqual({
        foo: 20,
        box: { bar: "updated", list: [999, 23, 56] },
      });
    });

    it("procedures can mutate in place the drafts provided to the setter functions", async () => {
      const q1 = quark({ foo: 1, box: { bar: "hello", list: [1, 23, 56] } }, {
        middlewares: [createImmerMiddleware()],
      });
      const q2 = quark({ foo: 1, box: { bar: "hello", list: [1, 23, 56] } }, {
        middlewares: [createImmerMiddleware()],
      });

      const c = collection({ q1, q2 }, {
        mode: "queue",
        actions: {
          async *procedure(api) {
            yield api.q1.set(draft => {
              draft.foo = 5;
              draft.box.list.push(200);
              return draft;
            });
            await sleep(10);
            return api.q2.set(draft => {
              draft.foo = 50;
              draft.box.bar = "procedure";
              return draft;
            });
          },
        },
      });

      const p = c.act.procedure();
      await sleep(5);

      expect(q1.get()).toEqual({
        foo: 5,
        box: { bar: "hello", list: [1, 23, 56, 200] },
      });
      expect(q2.get()).toEqual({
        foo: 1,
        box: { bar: "hello", list: [1, 23, 56] },
      });

      await p;

      expect(q1.get()).toEqual({
        foo: 5,
        box: { bar: "hello", list: [1, 23, 56, 200] },
      });
      expect(q2.get()).toEqual({
        foo: 50,
        box: { bar: "procedure", list: [1, 23, 56] },
      });
    });

    it("collection.set() can mutate in place the drafts provided to the setter functions", async () => {
      const q1 = quark({ foo: 1, box: { bar: "hello", list: [1, 23, 56] } }, {
        middlewares: [createImmerMiddleware()],
      });
      const q2 = quark({ foo: 1, box: { bar: "hello", list: [1, 23, 56] } }, {
        middlewares: [createImmerMiddleware()],
      });

      const c = collection({ q1, q2 });

      c.set(api => {
        api.q1.set(draft => {
          draft.foo = 100;
          draft.box.bar = "from set";
          return draft;
        });
        api.q2.set(draft => {
          draft.foo = 200;
          draft.box.list.unshift(0);
          return draft;
        });
      });

      expect(q1.get()).toEqual({
        foo: 100,
        box: { bar: "from set", list: [1, 23, 56] },
      });
      expect(q2.get()).toEqual({
        foo: 200,
        box: { bar: "hello", list: [0, 1, 23, 56] },
      });
    });

    it("set with promise resolving to setter function", async () => {
      const q1 = quark({ foo: 1 }, { middlewares: [createImmerMiddleware()] });
      const q2 = quark({ bar: "a" }, {
        middlewares: [createImmerMiddleware()],
      });

      const c = collection({ q1, q2 }, {
        mode: "queue",
        actions: {
          asyncPromiseSetter(api) {
            api.q1.set(
              sleep(10).then(() => (draft) => {
                draft.foo = 100;
                return draft;
              }),
            );
            api.q2.set(
              sleep(5).then(() => (draft) => {
                draft.bar = "updated";
                return draft;
              }),
            );
          },
        },
      });

      await c.act.asyncPromiseSetter();

      expect(q1.get()).toEqual({ foo: 100 });
      expect(q2.get()).toEqual({ bar: "updated" });
    });

    it("async setter function", async () => {
      const q1 = quark({ foo: 1 }, { middlewares: [createImmerMiddleware()] });
      const q2 = quark({ bar: "a" }, {
        middlewares: [createImmerMiddleware()],
      });

      const c = collection({ q1, q2 }, {
        mode: "queue",
        actions: {
          asyncSetterReturnPromise(api) {
            api.q1.set(async (draft) => {
              await sleep(10);
              draft.foo = 100;
              return draft;
            });
            api.q2.set(async (draft) => {
              await sleep(5);
              draft.bar = "updated";
              return draft;
            });
          },
        },
      });

      await c.act.asyncSetterReturnPromise();

      expect(q1.get()).toEqual({ foo: 100 });
      expect(q2.get()).toEqual({ bar: "updated" });
    });

    it("sync setter function returning a Promise resolving to a setter", async () => {
      const q1 = quark({ foo: 1 }, { middlewares: [createImmerMiddleware()] });
      const q2 = quark({ bar: "a" }, {
        middlewares: [createImmerMiddleware()],
      });

      const c = collection({ q1, q2 }, {
        mode: "queue",
        actions: {
          asyncSetterReturnPromise(api) {
            api.q1.set(() => {
              return sleep(10).then(() => draft => {
                draft.foo = 100;
                return draft;
              });
            });
            api.q2.set(() => {
              return sleep(10).then(() => draft => {
                draft.bar = "updated";
                return draft;
              });
            });
          },
        },
      });

      await c.act.asyncSetterReturnPromise();

      expect(q1.get()).toEqual({ foo: 100 });
      expect(q2.get()).toEqual({ bar: "updated" });
    });

    it("async procedure with promise-based setter functions", async () => {
      const q1 = quark({ foo: 1, list: [] as number[] }, {
        middlewares: [createImmerMiddleware()],
      });
      const q2 = quark({ bar: "a", count: 0 }, {
        middlewares: [createImmerMiddleware()],
      });

      const c = collection({ q1, q2 }, {
        mode: "queue",
        actions: {
          async *complexProcedure(api) {
            yield api.q1.set(
              sleep(10).then(() => (draft) => {
                draft.foo = 100;
                draft.list.push(1);
                return draft;
              }),
            );
            await sleep(5);
            return api.q2.set(async (draft) => {
              await sleep(10);
              draft.bar = "updated";
              draft.count = 5;
              return draft;
            });
          },
        },
      });

      const p = c.act.complexProcedure();
      await sleep(3);

      expect(q1.get()).toEqual({ foo: 1, list: [] });
      expect(q2.get()).toEqual({ bar: "a", count: 0 });

      await p;

      expect(q1.get()).toEqual({ foo: 100, list: [1] });
      expect(q2.get()).toEqual({ bar: "updated", count: 5 });
    });
  });
});
