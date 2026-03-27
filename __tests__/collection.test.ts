import { act, renderHook } from "@testing-library/react-hooks";
import { describe, expect, it } from "vitest";
import { collection, composeSelectors, quark } from "../src";
import { sleep } from "./helpers";

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
});
