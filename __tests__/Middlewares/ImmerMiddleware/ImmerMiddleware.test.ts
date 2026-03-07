import { act, renderHook } from "@testing-library/react-hooks";
import { isDraft } from "immer";
import { beforeAll, describe, expect, it, vitest } from "vitest";
import {
  addGlobalQuarkMiddleware,
  createImmerMiddleware,
  quark,
} from "../../../src/index";
import { sleep } from "../../helpers";

describe("ImmerMiddleware", () => {
  beforeAll(() => {
    addGlobalQuarkMiddleware(
      createImmerMiddleware({ mapAndSetSupport: true }),
    );
  });

  describe("outside react", () => {
    it("should allow for mutating quark state with simple dispatch function and not mutate the original state while update is in progress", () => {
      const q = quark({ foo: "foo", bar: "bar", baz: "baz" });

      expect.assertions(4);

      q.set((current) => {
        current.bar = "not really a bar";

        expect(isDraft(current)).toEqual(true);
        expect(q.get()).toEqual({ foo: "foo", bar: "bar", baz: "baz" });

        return current;
      });

      expect(q.get()).toEqual({
        foo: "foo",
        bar: "not really a bar",
        baz: "baz",
      });
      expect(isDraft(q.get())).toEqual(false);
    });

    it("should not change the previous state version", () => {
      const q = quark({ foo: "foo", bar: "bar", baz: "baz" });

      const originalCopy = q.get();

      q.set((current) => {
        current.bar = "not really a bar";
        return current;
      });

      expect(q.get()).toEqual({
        foo: "foo",
        bar: "not really a bar",
        baz: "baz",
      });
      expect(originalCopy).toEqual({ foo: "foo", bar: "bar", baz: "baz" });
    });

    it("should notify subscribers when updating the state with mutations as usual", async () => {
      const onStateChange = vitest.fn((newState: any) => {});

      const q = quark({ foo: "foo", bar: "bar", baz: "baz" });

      q.subscribe(onStateChange);

      q.set((current) => {
        current.bar = "not really a bar";
        current.foo = "not really a foo either";

        return current;
      });

      await sleep(1);

      expect(onStateChange).toHaveBeenCalledWith(
        {
          foo: "not really a foo either",
          bar: "not really a bar",
          baz: "baz",
        },
        expect.anything(), // cancelSubscription function
      );
    });

    it("should work correctly with async updates", async () => {
      const onStateChange = vitest.fn((newState: any) => {});

      const q = quark({ foo: "foo", bar: "bar", baz: "baz" });

      q.subscribe(onStateChange);

      const setAction = q.set(async (current) => {
        current.foo = "a";
        await sleep(10);
        current.baz = "b";
        return current;
      });

      expect(isDraft(q.get())).toEqual(false);
      expect(q.get()).toEqual({ foo: "foo", bar: "bar", baz: "baz" });

      await setAction;
      await sleep(20);

      expect(isDraft(q.get())).toEqual(false);
      expect(q.get()).toEqual({ foo: "a", bar: "bar", baz: "b" });

      expect(onStateChange).toHaveBeenCalledWith(
        { foo: "a", bar: "bar", baz: "b" },
        expect.anything(), // cancelSubscription function
      );
    });

    it("should work correctly with async generators", async () => {
      const onStateChange = vitest.fn((newState: any) => {});

      const q = quark({ foo: "foo", bar: "bar", baz: "baz" });

      q.subscribe(onStateChange);

      expect.assertions(16);

      await q.set(async (current) => {
        expect(isDraft(current)).toEqual(true);
        await sleep(10);
        return () => {
          current.foo = "1";
          return current;
        };
      });

      await sleep(20);

      expect(isDraft(q.get())).toEqual(false);
      expect(q.get()).toEqual({ foo: "1", bar: "bar", baz: "baz" });
      expect(onStateChange).toHaveBeenLastCalledWith(
        { foo: "1", bar: "bar", baz: "baz" },
        expect.anything(), // cancelSubscription function
      );

      await q.set(async () => {
        await sleep(10);
        return (current) => {
          expect(isDraft(current)).toEqual(true);
          current.foo = "2";
          return current;
        };
      });

      await sleep(20);

      expect(isDraft(q.get())).toEqual(false);
      expect(q.get()).toEqual({ foo: "2", bar: "bar", baz: "baz" });
      expect(onStateChange).toHaveBeenLastCalledWith(
        { foo: "2", bar: "bar", baz: "baz" },
        expect.anything(), // cancelSubscription function
      );

      await q.set(async (current1) => {
        expect(isDraft(current1)).toEqual(true);
        await sleep(10);
        return (current2) => {
          expect(isDraft(current2)).toEqual(true);
          current2.foo = "3";
          current1.bar = "3";
          return current1;
        };
      });

      await sleep(20);

      expect(isDraft(q.get())).toEqual(false);
      expect(q.get()).toEqual({ foo: "2", bar: "3", baz: "baz" });
      expect(onStateChange).toHaveBeenLastCalledWith(
        { foo: "2", bar: "3", baz: "baz" },
        expect.anything(), // cancelSubscription function
      );

      await q.set(async (current1) => {
        await sleep(10);
        return (current2) => {
          current2.foo = "4";
          current1.bar = "4";
          return current2;
        };
      });

      await sleep(20);

      expect(isDraft(q.get())).toEqual(false);
      expect(q.get()).toEqual({ foo: "4", bar: "3", baz: "baz" });
      expect(onStateChange).toHaveBeenLastCalledWith(
        { foo: "4", bar: "3", baz: "baz" },
        expect.anything(), // cancelSubscription function
      );
    });
  });

  describe("within react", () => {
    it("should allow for mutating quark state with simple dispatch function and not mutate the original state while update is in progress", async () => {
      const q = quark(
        { foo: "foo", bar: "bar", baz: "baz" },
        {
          actions: {
            setBar(api, value: string) {
              api.set((state) => {
                state.bar = value;
                return state;
              });
            },
          },
        },
      );

      const rendered = renderHook(() => q.use());

      expect(rendered.result.current.value).toEqual({
        foo: "foo",
        bar: "bar",
        baz: "baz",
      });
      expect(isDraft(rendered.result.current.value)).toEqual(false);

      await act(async () => {
        await rendered.result.current.setBar("not a bar");
      });

      await rendered.waitFor(() =>
        expect(rendered.result.current.value).toEqual({
          foo: "foo",
          bar: "not a bar",
          baz: "baz",
        })
      );
      expect(isDraft(rendered.result.current.value)).toEqual(false);
    });

    it("should not change the previous state version", async () => {
      const q = quark(
        { foo: "foo", bar: "bar", baz: "baz" },
        {
          actions: {
            setBar(api, value: string) {
              api.set(state => {
                expect(isDraft(state)).toEqual(true);
                state.bar = value;
                return state;
              });
            },
          },
        },
      );

      const rendered = renderHook(() => q.use());

      const original = rendered.result.current;

      await act(async () => {
        await rendered.result.current.setBar("not a bar");
      });

      await rendered.waitFor(() =>
        expect(rendered.result.current.value).toEqual({
          foo: "foo",
          bar: "not a bar",
          baz: "baz",
        })
      );
      expect(isDraft(rendered.result.current.value)).toEqual(false);

      expect(original.value).toEqual({ foo: "foo", bar: "bar", baz: "baz" });
    });

    it("should notify subscribers when updating the state with mutations as usual", async () => {
      const onStateChange = vitest.fn((newState: any) => {});

      const q = quark(
        { foo: "foo", bar: "bar", baz: "baz" },
        {
          actions: {
            setFoo(api, value: string) {
              api.set(currentState => {
                currentState.foo = value;
                return currentState;
              });
            },
            setBar(api, value: string) {
              api.set(currentState => {
                currentState.bar = value;
                return currentState;
              });
            },
          },
        },
      );

      const rendered = renderHook(() => q.use());

      q.subscribe(onStateChange);

      await act(async () => {
        await rendered.result.current.setFoo("not a foo");
        await rendered.result.current.setBar("not a bar");
      });

      await rendered.waitFor(() =>
        expect(rendered.result.current.value).toEqual({
          foo: "not a foo",
          bar: "not a bar",
          baz: "baz",
        })
      );

      expect(onStateChange).toHaveBeenCalledWith(
        {
          foo: "not a foo",
          bar: "not a bar",
          baz: "baz",
        },
        expect.anything(), // cancelSubscription function
      );
    });

    it("should work correctly with async updates", async () => {
      const onStateChange = vitest.fn((newState: any) => {});

      const q = quark(
        { foo: "foo", bar: "bar", baz: "baz" },
        {
          actions: {
            async setFoo(api, value: Promise<string>) {
              await api.set(async currentState => {
                currentState.foo = await value;
                return currentState;
              });
            },
            async setBaz(api, value: Promise<string>) {
              await api.set(async (currentState) => {
                currentState.baz = await value;
                return currentState;
              });
            },
          },
        },
      );

      const rendered = renderHook(() => q.use());

      q.subscribe(onStateChange);

      await act(async () => {
        await rendered.result.current.setFoo(Promise.resolve("a"));
        await rendered.result.current.setBaz(Promise.resolve("b"));
      });

      await rendered.waitFor(() =>
        expect(rendered.result.current.value).toEqual({
          foo: "a",
          bar: "bar",
          baz: "b",
        })
      );

      expect(onStateChange).toHaveBeenCalledWith(
        { foo: "a", bar: "bar", baz: "b" },
        expect.anything(), // cancelSubscription function
      );
    });
  });

  it("api.get() should not return a draft", async () => {
    const q = quark({ foo: 1, bar: 2 }, {
      actions: {
        action(api) {
          const state = api.get();
          expect(isDraft(state)).toBe(false);

          api.set((draft) => {
            expect(isDraft(draft)).toBe(true);
            return draft;
          });
        },
        async *procedure(api) {
          const state = api.get();
          expect(isDraft(state)).toBe(false);

          yield draft => {
            expect(isDraft(draft)).toBe(true);
            return draft;
          };

          return draft => {
            expect(isDraft(draft)).toBe(true);
            return draft;
          };
        },
      },
    });

    expect.assertions(5);

    q.act.action();
    await q.act.procedure();
  });

  it("api.assign() doesn't accidentally leave drafts in the quark state", async () => {
    const q = quark({ foo: 1, bar: 2, baz: { qux: 4 } }, {
      actions: {
        setBar(api, v: number) {
          api.assign({ bar: v });
        },
        setQux(api, v: number) {
          api.assign(
            s => s.baz,
            { qux: v },
          );
        },
        async *procedure(api, v1: number, v2: number) {
          yield api.assign({ bar: v1 });
          yield api.assign(
            s => s.baz,
            { qux: v2 },
          );
          return s => s;
        },
      },
    });

    q.act.setBar(5);
    expect(isDraft(q.get())).toBeFalsy();
    expect(isDraft(q.get().baz)).toBeFalsy();
    expect(q.get()).toEqual({ foo: 1, bar: 5, baz: { qux: 4 } });

    q.act.setQux(8);
    expect(isDraft(q.get())).toBeFalsy();
    expect(isDraft(q.get().baz)).toBeFalsy();
    expect(q.get()).toEqual({ foo: 1, bar: 5, baz: { qux: 8 } });

    await q.act.procedure(11, 13);
    expect(isDraft(q.get())).toBeFalsy();
    expect(isDraft(q.get().baz)).toBeFalsy();
    expect(q.get()).toEqual({ foo: 1, bar: 11, baz: { qux: 13 } });

    q.assign({ foo: 99 });
    expect(isDraft(q.get())).toBeFalsy();
    expect(isDraft(q.get().baz)).toBeFalsy();
    expect(q.get()).toEqual({ foo: 99, bar: 11, baz: { qux: 13 } });

    q.assign(s => s.baz, { qux: 0 });
    expect(isDraft(q.get())).toBeFalsy();
    expect(isDraft(q.get().baz)).toBeFalsy();
    expect(q.get()).toEqual({ foo: 99, bar: 11, baz: { qux: 0 } });
  });

  it("putting draft sub-properties in a new new returned object get handled", () => {
    const q = quark({
      top: "hi",
      list: [
        { v: 1 },
        { v: 2 },
        { v: 3 },
      ],
      box: { value: 3, subbox: { value: 6 } },
    }, {
      actions: {
        setAt(api, targetIdx: number, v: number) {
          api.set(state => ({
            ...state,
            list: state.list.map((elem, idx) => {
              if (idx === targetIdx) {
                return { v };
              }
              return elem;
            }),
          }));
        },
        append(api, v: number) {
          api.set(state => ({
            ...state,
            list: [...state.list, { v }],
          }));
        },
        setBoxValue(api, value: number) {
          api.set(state => ({
            ...state,
            box: {
              ...state.box,
              value,
            },
          }));
        },
      },
    });

    expect(q.get()).toEqual({
      top: "hi",
      list: [
        { v: 1 },
        { v: 2 },
        { v: 3 },
      ],
      box: { value: 3, subbox: { value: 6 } },
    });

    q.act.setAt(1, 7);
    expect(isDraft(q.get())).toBeFalsy();
    expect(isDraft(q.get().list)).toBeFalsy();
    expect(isDraft(q.get().list[0])).toBeFalsy();
    expect(isDraft(q.get().list[1])).toBeFalsy();
    expect(isDraft(q.get().list[2])).toBeFalsy();
    expect(isDraft(q.get().box)).toBeFalsy();
    expect(isDraft(q.get().box.subbox)).toBeFalsy();
    expect(q.get()).toEqual({
      top: "hi",
      list: [
        { v: 1 },
        { v: 7 },
        { v: 3 },
      ],
      box: { value: 3, subbox: { value: 6 } },
    });

    q.act.append(13);
    expect(isDraft(q.get())).toBeFalsy();
    expect(isDraft(q.get().list)).toBeFalsy();
    expect(isDraft(q.get().list[0])).toBeFalsy();
    expect(isDraft(q.get().list[1])).toBeFalsy();
    expect(isDraft(q.get().list[2])).toBeFalsy();
    expect(isDraft(q.get().list[3])).toBeFalsy();
    expect(isDraft(q.get().box)).toBeFalsy();
    expect(isDraft(q.get().box.subbox)).toBeFalsy();
    expect(q.get()).toEqual({
      top: "hi",
      list: [
        { v: 1 },
        { v: 7 },
        { v: 3 },
        { v: 13 },
      ],
      box: { value: 3, subbox: { value: 6 } },
    });

    q.act.setBoxValue(69);
    expect(isDraft(q.get())).toBeFalsy();
    expect(isDraft(q.get().list)).toBeFalsy();
    expect(isDraft(q.get().list[0])).toBeFalsy();
    expect(isDraft(q.get().list[1])).toBeFalsy();
    expect(isDraft(q.get().list[2])).toBeFalsy();
    expect(isDraft(q.get().list[3])).toBeFalsy();
    expect(isDraft(q.get().box)).toBeFalsy();
    expect(isDraft(q.get().box.subbox)).toBeFalsy();
    expect(q.get()).toEqual({
      top: "hi",
      list: [
        { v: 1 },
        { v: 7 },
        { v: 3 },
        { v: 13 },
      ],
      box: { value: 69, subbox: { value: 6 } },
    });
  });

  it("recursive object structures do not cause issues", () => {
    const s = {
      foo: {
        value: "foo",
        bar: {
          value: "bar",
          baz: {
            value: "baz",
            fooBox: {} as any,
            barBox: {} as any,
            bazBox: {} as any,
          },
          fooBox: {} as any,
          barBox: {} as any,
          bazBox: {} as any,
        },
        fooBox: {} as any,
        barBox: {} as any,
        bazBox: {} as any,
      },
      fooBox: {} as any,
      barBox: {} as any,
      bazBox: {} as any,
    };

    s.foo.bar.baz.fooBox = s;
    s.foo.bar.baz.barBox = s.foo;
    s.foo.bar.baz.bazBox = s.foo.bar;

    s.foo.bar.fooBox = s;
    s.foo.bar.barBox = s.foo;
    s.foo.bar.bazBox = s.foo.bar;

    s.foo.fooBox = s;
    s.foo.barBox = s.foo;
    s.foo.bazBox = s.foo.bar;

    const q = quark(s);

    const nextExpectedState = {
      ...q.get(),
      foo: {
        ...q.get().foo,
        value: "foo2",
      },
    };

    q.set(state => ({
      ...state,
      foo: {
        ...state.foo,
        value: "foo2",
      },
    }));
    expect(q.get()).toEqual(nextExpectedState);
    expect(isDraft(q.get())).toBeFalsy();
    expect(isDraft(q.get().foo)).toBeFalsy();
    expect(isDraft(q.get().fooBox)).toBeFalsy();
    expect(isDraft(q.get().bazBox)).toBeFalsy();
    expect(isDraft(q.get().barBox)).toBeFalsy();
    expect(isDraft(q.get().foo.fooBox)).toBeFalsy();
    expect(isDraft(q.get().foo.bazBox)).toBeFalsy();
    expect(isDraft(q.get().foo.barBox)).toBeFalsy();
    expect(isDraft(q.get().foo.bar.fooBox)).toBeFalsy();
    expect(isDraft(q.get().foo.bar.bazBox)).toBeFalsy();
    expect(isDraft(q.get().foo.bar.barBox)).toBeFalsy();
  });
});
