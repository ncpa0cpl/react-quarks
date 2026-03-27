import { act, renderHook } from "@testing-library/react-hooks";
import { describe, expect, it } from "vitest";
import {
  collection,
  composeSelectors,
  quark,
  QuarkType,
  SetStateAction,
} from "../src";
import { controlledPromise, sleep } from "./helpers";

describe("Quakr Collection", () => {
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

    // describe("cancel mode", () => {
    //   it("cancels previous collection actions when new one is dispatched", async () => {
    //     const q1 = quark({ value: 0, canceled: false });
    //     const q2 = quark({ value: "", canceled: false });

    //     const c = collection({ q1, q2 }, {
    //       mode: "cancel",
    //       actions: {
    //         async action1(api) {
    //           api.q1.set({ value: 1, canceled: false });
    //           api.q2.set({ value: "a", canceled: false });
    //           await sleep(50);
    //           if (api.isCanceled()) return;
    //           api.q1.set({ value: 10, canceled: false });
    //           api.q2.set({ value: "aa", canceled: false });
    //         },
    //         async action2(api) {
    //           api.q1.set({ value: 2, canceled: false });
    //           api.q2.set({ value: "b", canceled: false });
    //           await sleep(10);
    //           if (api.isCanceled()) return;
    //           api.q1.set({ value: 20, canceled: false });
    //           api.q2.set({ value: "bb", canceled: false });
    //         },
    //       },
    //     });

    //     c.act.action1();
    //     await sleep(5);
    //     await c.act.action2();

    //     expect(c.get().q1.value).toBe(20);
    //     expect(c.get().q2.value).toBe("bb");
    //   });

    //   it("cancel mode ignores state updates from cancelled actions", async () => {
    //     const counter = quark(0);

    //     const c = collection({ counter }, {
    //       mode: "cancel",
    //       actions: {
    //         async incrementWithDelay(api, amount: number, delay: number) {
    //           api.counter.set(s => s + 1);
    //           await sleep(delay);
    //           if (api.isCanceled()) return;
    //           api.counter.set(s => s + amount);
    //         },
    //       },
    //     });

    //     c.act.incrementWithDelay(100, 50);
    //     await sleep(10);
    //     await c.act.incrementWithDelay(10, 5);

    //     expect(c.get().counter).toBe(12);
    //   });

    //   it("isCanceled returns true for cancelled actions", async () => {
    //     const q = quark({ value: 0 });
    //     let wasCanceled = false;

    //     const c = collection({ q }, {
    //       mode: "cancel",
    //       actions: {
    //         async checkCanceled(api) {
    //           await sleep(30);
    //           wasCanceled = api.isCanceled();
    //         },
    //       },
    //     });

    //     c.act.checkCanceled();
    //     await sleep(10);
    //     c.act.checkCanceled();

    //     await sleep(50);

    //     expect(wasCanceled).toBe(true);
    //   });

    //   it("async updates from cancelled collection actions are ignored", async () => {
    //     const values = quark<number[]>([]);

    //     const c = collection({ values }, {
    //       mode: "cancel",
    //       actions: {
    //         async addValue(api, value: number, delay: number) {
    //           await sleep(delay);
    //           api.values.set(arr => [...arr, value]);
    //         },
    //       },
    //     });

    //     c.act.addValue(1, 50);
    //     await sleep(10);
    //     c.act.addValue(2, 20);
    //     await sleep(10);
    //     await c.act.addValue(3, 5);

    //     expect(c.get().values).toEqual([3]);
    //   });
    // });

    // describe("none mode", () => {
    //   it("executes actions immediately without queuing or canceling", async () => {
    //     const q = quark({ value: 0 });

    //     const c = collection({ q }, {
    //       mode: "none",
    //       actions: {
    //         setValue(api, val: number) {
    //           api.q.set({ value: val });
    //         },
    //       },
    //     });

    //     c.act.setValue(1);
    //     c.act.setValue(2);
    //     c.act.setValue(3);

    //     expect(c.get().q.value).toBe(3);
    //   });

    //   it("async actions in none mode do not queue", async () => {
    //     const order: string[] = [];
    //     const q = quark({ value: 0 });

    //     const c = collection({ q }, {
    //       mode: "none",
    //       actions: {
    //         async asyncAction(api, name: string, delay: number) {
    //           await sleep(delay);
    //           order.push(name);
    //           api.q.set({ value: order.length });
    //         },
    //       },
    //     });

    //     c.act.asyncAction("first", 30);
    //     c.act.asyncAction("second", 10);
    //     c.act.asyncAction("third", 20);

    //     await sleep(50);

    //     expect(order).toEqual(["second", "third", "first"]);
    //   });
    // });

    // describe("mixed modes", () => {
    //   it("collection in queue mode with quark in cancel mode", async () => {
    //     const q = quark({ value: 0 }, { mode: "cancel" });

    //     const c = collection({ q }, {
    //       mode: "queue",
    //       actions: {
    //         async action1(api) {
    //           api.q.set({ value: 1 });
    //           await sleep(20);
    //           api.q.set({ value: 10 });
    //         },
    //         async action2(api) {
    //           api.q.set({ value: 2 });
    //           await sleep(10);
    //           api.q.set({ value: 20 });
    //         },
    //       },
    //     });

    //     await Promise.all([
    //       c.act.action1(),
    //       c.act.action2(),
    //     ]);

    //     expect(c.get().q.value).toBe(20);
    //   });

    //   it("collection in cancel mode with quark in queue mode", async () => {
    //     const q = quark({ value: 0, order: [] as number[] }, { mode: "queue" });

    //     const c = collection({ q }, {
    //       mode: "cancel",
    //       actions: {
    //         async action1(api) {
    //           api.q.set(s => ({ value: s.value + 1, order: [...s.order, 1] }));
    //           await sleep(30);
    //           if (api.isCanceled()) return;
    //           api.q.set(s => ({
    //             value: s.value + 10,
    //             order: [...s.order, 10],
    //           }));
    //         },
    //         async action2(api) {
    //           api.q.set(s => ({ value: s.value + 2, order: [...s.order, 2] }));
    //           await sleep(10);
    //           if (api.isCanceled()) return;
    //           api.q.set(s => ({
    //             value: s.value + 20,
    //             order: [...s.order, 20],
    //           }));
    //         },
    //       },
    //     });

    //     c.act.action1();
    //     await sleep(5);
    //     await c.act.action2();

    //     await sleep(50);

    //     expect(c.get().q.order).toEqual([2, 20]);
    //   });

    //   it("multiple quarks with different modes in one collection", async () => {
    //     const queueQuark = quark({ value: 0, order: [] as string[] }, {
    //       mode: "queue",
    //     });
    //     const cancelQuark = quark({ value: 0 }, { mode: "cancel" });
    //     const noneQuark = quark({ value: 0 });

    //     const c = collection({ queueQuark, cancelQuark, noneQuark }, {
    //       mode: "queue",
    //       actions: {
    //         async updateAll(api, delay: number, label: string) {
    //           await sleep(delay);
    //           api.queueQuark.set(s => ({
    //             value: s.value + 1,
    //             order: [...s.order, label],
    //           }));
    //           api.cancelQuark.set(s => s + 1);
    //           api.noneQuark.set(s => s + 1);
    //         },
    //       },
    //     });

    //     await Promise.all([
    //       c.act.updateAll(30, "first"),
    //       c.act.updateAll(10, "second"),
    //     ]);

    //     expect(c.get().queueQuark.order).toEqual(["first", "second"]);
    //     expect(c.get().cancelQuark.value).toBe(2);
    //     expect(c.get().noneQuark.value).toBe(2);
    //   });
    // });

    // describe("async dispatches with different modes", () => {
    //   it("collection queue mode with promise dispatches", async () => {
    //     const q = quark({ value: 0, history: [] as number[] });

    //     const c = collection({ q }, {
    //       mode: "queue",
    //       actions: {
    //         async promiseDispatch(api, value: number, delay: number) {
    //           const promise = sleep(delay).then(() => ({
    //             value,
    //             history: [...api.q.get().history, value],
    //           }));
    //           api.q.set(promise);
    //         },
    //       },
    //     });

    //     await Promise.all([
    //       c.act.promiseDispatch(1, 30),
    //       c.act.promiseDispatch(2, 10),
    //       c.act.promiseDispatch(3, 20),
    //     ]);

    //     expect(c.get().q.history).toEqual([1, 2, 3]);
    //     expect(c.get().q.value).toBe(3);
    //   });

    //   it("collection cancel mode with promise dispatches", async () => {
    //     const q = quark({ value: 0 });

    //     const c = collection({ q }, {
    //       mode: "cancel",
    //       actions: {
    //         async promiseDispatch(api, value: number, delay: number) {
    //           const promise = sleep(delay).then(() => ({ value }));
    //           await api.q.set(promise);
    //         },
    //       },
    //     });

    //     c.act.promiseDispatch(1, 50);
    //     await sleep(10);
    //     c.act.promiseDispatch(2, 20);
    //     await sleep(10);
    //     await c.act.promiseDispatch(3, 5);

    //     expect(c.get().q.value).toBe(3);
    //   });

    //   it("function dispatches in collection actions", async () => {
    //     const q = quark({ value: 0, count: 0 });

    //     const c = collection({ q }, {
    //       mode: "queue",
    //       actions: {
    //         async functionDispatch(api, times: number) {
    //           for (let i = 0; i < times; i++) {
    //             api.q.set(s => ({
    //               value: s.value + 1,
    //               count: s.count + 1,
    //             }));
    //           }
    //           await sleep(10);
    //         },
    //       },
    //     });

    //     await Promise.all([
    //       c.act.functionDispatch(3),
    //       c.act.functionDispatch(5),
    //     ]);

    //     expect(c.get().q.count).toBe(8);
    //     expect(c.get().q.value).toBe(8);
    //   });

    //   it("nested dispatch functions in collection actions", async () => {
    //     const q = quark({ value: 0, nested: { deep: 0 } });

    //     const c = collection({ q }, {
    //       mode: "queue",
    //       actions: {
    //         async nestedDispatch(api) {
    //           api.q.set(s => ({
    //             ...s,
    //             value: s.value + 1,
    //             nested: { deep: s.nested.deep + 1 },
    //           }));
    //           await sleep(10);
    //           api.q.set(s => prev => ({
    //             ...s,
    //             value: prev.value + 10,
    //             nested: { deep: prev.nested.deep + 10 },
    //           }));
    //         },
    //       },
    //     });

    //     await c.act.nestedDispatch();

    //     expect(c.get().q.value).toBe(11);
    //     expect(c.get().q.nested.deep).toBe(11);
    //   });
    // });

    // describe("race condition handling", () => {
    //   it("collection queue mode prevents race conditions with concurrent updates", async () => {
    //     const counter = quark(0);

    //     const c = collection({ counter }, {
    //       mode: "queue",
    //       actions: {
    //         async incrementWithRandomDelay(api) {
    //           const current = api.counter.get();
    //           await sleep(Math.random() * 20);
    //           api.counter.set(current + 1);
    //         },
    //       },
    //     });

    //     const promises = [];
    //     for (let i = 0; i < 10; i++) {
    //       promises.push(c.act.incrementWithRandomDelay());
    //     }

    //     await Promise.all(promises);

    //     expect(c.get().counter).toBe(10);
    //   });

    //   it("collection cancel mode ensures last update wins", async () => {
    //     const value = quark("");

    //     const c = collection({ value }, {
    //       mode: "cancel",
    //       actions: {
    //         async setValueWithDelay(api, val: string, delay: number) {
    //           await sleep(delay);
    //           api.value.set(val);
    //         },
    //       },
    //     });

    //     const promises = [];
    //     for (let i = 0; i < 5; i++) {
    //       promises.push(
    //         c.act.setValueWithDelay(`value-${i}`, Math.random() * 30),
    //       );
    //     }

    //     await Promise.all(promises);
    //     await sleep(50);

    //     expect(c.get().value).toBe("value-4");
    //   });

    //   it("mixed concurrent actions with different delays", async () => {
    //     const results = quark<string[]>([]);

    //     const c = collection({ results }, {
    //       mode: "queue",
    //       actions: {
    //         async addResult(api, label: string, delay: number) {
    //           await sleep(delay);
    //           api.results.set(arr => [...arr, label]);
    //         },
    //       },
    //     });

    //     await Promise.all([
    //       c.act.addResult("fast", 5),
    //       c.act.addResult("medium", 15),
    //       c.act.addResult("slow", 25),
    //     ]);

    //     expect(c.get().results).toEqual(["fast", "medium", "slow"]);
    //   });
    // });

    // describe("procedures in collections", () => {
    //   it("generator actions in queue mode execute yields in order", async () => {
    //     const q = quark({ values: [] as number[], inProgress: false });

    //     const c = collection({ q }, {
    //       mode: "queue",
    //       actions: {
    //         async *procedure(api) {
    //           yield { values: [...api.q.get().values], inProgress: true };
    //           await sleep(20);
    //           yield { values: [...api.q.get().values, 1], inProgress: true };
    //           await sleep(10);
    //           yield { values: [...api.q.get().values, 2], inProgress: true };
    //           return { values: [...api.q.get().values, 3], inProgress: false };
    //         },
    //       },
    //     });

    //     await c.act.procedure();

    //     expect(c.get().q.values).toEqual([1, 2, 3]);
    //     expect(c.get().q.inProgress).toBe(false);
    //   });

    //   it("generator actions in cancel mode stop on cancellation", async () => {
    //     const q = quark({ values: [] as number[] });

    //     const c = collection({ q }, {
    //       mode: "cancel",
    //       actions: {
    //         async *procedure(api) {
    //           yield { values: [...api.q.get().values, 1] };
    //           await sleep(30);
    //           if (api.isCanceled()) return;
    //           yield { values: [...api.q.get().values, 2] };
    //           await sleep(30);
    //           if (api.isCanceled()) return;
    //           yield { values: [...api.q.get().values, 3] };
    //           return { values: [...api.q.get().values, 4] };
    //         },
    //       },
    //     });

    //     c.act.procedure();
    //     await sleep(10);
    //     c.act.procedure();

    //     await sleep(100);

    //     expect(c.get().q.values).toEqual([1, 1]);
    //   });
    // });

    // describe("collection set() method", () => {
    //   it("set() with callback executes atomically in queue mode", async () => {
    //     const q1 = quark(0);
    //     const q2 = quark("");

    //     const c = collection({ q1, q2 }, {
    //       mode: "queue",
    //     });

    //     await c.set(async (api) => {
    //       api.q1.set(1);
    //       api.q2.set("a");
    //       await sleep(10);
    //       api.q1.set(2);
    //       api.q2.set("b");
    //     });

    //     expect(c.get().q1).toBe(2);
    //     expect(c.get().q2).toBe("b");
    //   });

    //   it("set() cancels previous in cancel mode", async () => {
    //     const q = quark({ value: 0, steps: [] as string[] });

    //     const c = collection({ q }, {
    //       mode: "cancel",
    //     });

    //     c.set(async (api) => {
    //       api.q.set({ value: 1, steps: [...api.q.get().steps, "step1"] });
    //       await sleep(30);
    //       if (api.isCanceled()) return;
    //       api.q.set({ value: 2, steps: [...api.q.get().steps, "step2"] });
    //     });

    //     await sleep(10);

    //     await c.set(async (api) => {
    //       api.q.set({ value: 10, steps: [...api.q.get().steps, "new-step1"] });
    //       await sleep(5);
    //       api.q.set({ value: 20, steps: [...api.q.get().steps, "new-step2"] });
    //     });

    //     await sleep(50);

    //     expect(c.get().q.value).toBe(20);
    //     expect(c.get().q.steps).toEqual(["new-step1", "new-step2"]);
    //   });
    // });
  });
});
