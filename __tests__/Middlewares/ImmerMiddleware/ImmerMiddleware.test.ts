import { act, renderHook } from "@testing-library/react-hooks";
import { isDraft } from "immer";
import {
  createImmerMiddleware,
  quark,
  setGlobalQuarkMiddlewares,
} from "../../../src/index";
import { sleep } from "../../helpers";

describe("ImmerMiddleware", () => {
  beforeAll(() => {
    setGlobalQuarkMiddlewares([createImmerMiddleware({ mapAndSetSupport: true })]);
  });

  describe("outside react", () => {
    it("should allow for mutating quark state with simple dispatch function and not mutate the original state while update is in progress", () => {
      const q = quark({ foo: "foo", bar: "bar", baz: "baz" });

      q.set((current) => {
        current.bar = "not really a bar";

        expect(isDraft(current)).toEqual(true);
        expect(q.get()).toEqual({ foo: "foo", bar: "bar", baz: "baz" });

        return current;
      });

      expect(q.get()).toEqual({ foo: "foo", bar: "not really a bar", baz: "baz" });
      expect(isDraft(q.get())).toEqual(false);
    });

    it("should not change the previous state version", () => {
      const q = quark({ foo: "foo", bar: "bar", baz: "baz" });

      const originalCopy = q.get();

      q.set((current) => {
        current.bar = "not really a bar";
        return current;
      });

      expect(q.get()).toEqual({ foo: "foo", bar: "not really a bar", baz: "baz" });
      expect(originalCopy).toEqual({ foo: "foo", bar: "bar", baz: "baz" });
    });

    it("should notify subscribers when updating the state with mutations as usual", async () => {
      const onStateChange = jest.fn((newState: any) => {});

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
        expect.anything() // cancelSubscription function
      );
    });

    it("should work correctly with async updates", async () => {
      const onStateChange = jest.fn((newState: any) => {});

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
        expect.anything() // cancelSubscription function
      );
    });

    it("should work correctly with async generators", async () => {
      const onStateChange = jest.fn((newState: any) => {});

      const q = quark({ foo: "foo", bar: "bar", baz: "baz" });

      q.subscribe(onStateChange);

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
        expect.anything() // cancelSubscription function
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
        expect.anything() // cancelSubscription function
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
        expect.anything() // cancelSubscription function
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
        expect.anything() // cancelSubscription function
      );
    });
  });

  describe("within react", () => {
    it("should allow for mutating quark state with simple dispatch function and not mutate the original state while update is in progress", async () => {
      const q = quark(
        { foo: "foo", bar: "bar", baz: "baz" },
        {
          actions: {
            setBar(state, value: string) {
              state.bar = value;
              return state;
            },
          },
        }
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
            setBar(currentState, value: string) {
              expect(isDraft(currentState)).toEqual(true);
              currentState.bar = value;
              return currentState;
            },
          },
        }
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
      const onStateChange = jest.fn((newState: any) => {});

      const q = quark(
        { foo: "foo", bar: "bar", baz: "baz" },
        {
          actions: {
            setFoo(currentState, value: string) {
              currentState.foo = value;
              return currentState;
            },
            setBar(currentState, value: string) {
              currentState.bar = value;
              return currentState;
            },
          },
        }
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
        expect.anything() // cancelSubscription function
      );
    });

    it("should work correctly with async updates", async () => {
      const onStateChange = jest.fn((newState: any) => {});

      const q = quark(
        { foo: "foo", bar: "bar", baz: "baz" },
        {
          actions: {
            async setFoo(currentState, value: Promise<string>) {
              currentState.foo = await value;
              return currentState;
            },
            async setBaz(currentState, value: Promise<string>) {
              currentState.baz = await value;
              return currentState;
            },
          },
        }
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
        expect.anything() // cancelSubscription function
      );
    });
  });
});
