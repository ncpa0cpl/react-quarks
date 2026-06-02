import { renderHook } from "@testing-library/react-hooks";
import { describe, expect, it, vitest } from "vitest";
import { composeSelectors, rest } from "../src";

// @ts-expect-error
global.IS_REACT_ACT_ENVIRONMENT = true;

const sleep = (t: number) => new Promise(res => setTimeout(res, t));

const delayed = <A extends any[], R>(
  fn: (...args: A) => Promise<R>,
  time = 50,
) => {
  return vitest.fn(async (...args: A): Promise<R> => {
    await sleep(time);
    return await fn(...args);
  });
};

describe("rest quark", () => {
  it("fetches on mount a single element", async () => {
    const serverState = [{ id: 1, value: "a" }, { id: 2, value: "b" }];

    const q = rest({
      id: entry => entry.id,
      get: delayed(async (id) => serverState.find(e => e.id === id)),
      list: delayed(async () => [...serverState]),
      options: { auto: false },
      mutations: {},
      selectors: {},
    });

    const hook = renderHook((props: { id?: number } = {}) =>
      q.select.useGet(props.id ?? 1)
    );

    expect(hook.result.current).toMatchObject({
      data: undefined,
      loading: true,
      initiated: false,
      error: undefined,
    });

    await hook.waitFor(() => {
      expect(hook.result.current).toMatchObject({
        data: { id: 1, value: "a" },
        loading: false,
        initiated: true,
        error: undefined,
      });
    });

    hook.rerender({ id: 2 });
    expect(hook.result.current).toMatchObject({
      data: undefined,
      loading: true,
      initiated: false,
      error: undefined,
    });

    await hook.waitFor(() => {
      expect(hook.result.current).toMatchObject({
        data: { id: 2, value: "b" },
        loading: false,
        initiated: true,
        error: undefined,
      });
    });

    hook.rerender({ id: 1 });
    expect(hook.result.current).toMatchObject({
      data: { id: 1, value: "a" },
      loading: true,
      initiated: true,
      error: undefined,
    });
  });

  it("fetches on mount the list of elems", async () => {
    const serverState = [{ id: 1, value: "a" }, { id: 2, value: "b" }];

    const q = rest({
      id: entry => entry.id,
      get: async (id) => serverState.find(e => e.id === id),
      list: async () => [...serverState],
      options: { auto: false },
      mutations: {},
      selectors: {},
    });

    const hook = renderHook(() => q.use());

    await hook.waitFor(() => {
      expect(hook.result.current.value).toMatchObject({
        data: [{ id: 1, value: "a" }, { id: 2, value: "b" }],
        initiated: true,
        loading: false,
        error: undefined,
      });
    });
  });

  it("invalidate by id", async () => {
    const serverState = [{ id: 1, value: "a" }, { id: 2, value: "b" }];

    const q = rest({
      id: entry => entry.id,
      get: delayed(async (id) => serverState.find(e => e.id === id)),
      list: delayed(async () => [...serverState]),
      options: { auto: false },
      mutations: {},
      selectors: {},
    });

    const hook = renderHook((props: { id?: number } = {}) =>
      q.select.useGet(props.id ?? 1)
    );

    await hook.waitFor(() => {
      expect(hook.result.current).toMatchObject({
        data: { id: 1, value: "a" },
        loading: false,
        initiated: true,
        error: undefined,
      });
    });

    serverState[0] = { id: 1, value: "foobar" };
    expect(hook.result.current).toMatchObject({
      data: { id: 1, value: "a" },
      loading: false,
      initiated: true,
      error: undefined,
    });

    q.act.invalidate(1);

    expect(q.select.get(1)).toMatchObject({
      data: { id: 1, value: "a" },
      loading: true,
      initiated: true,
      error: undefined,
    });

    await hook.waitFor(() => {
      expect(hook.result.current).toMatchObject({
        data: { id: 1, value: "a" },
        loading: true,
        initiated: true,
        error: undefined,
      });
    });

    await hook.waitFor(() => {
      expect(hook.result.current).toMatchObject({
        data: { id: 1, value: "foobar" },
        loading: false,
        initiated: true,
        error: undefined,
      });
    });
  });

  it("invalidate all", async () => {
    const serverState = [{ id: 1, value: "a" }, { id: 2, value: "b" }];

    const q = rest({
      id: entry => entry.id,
      get: delayed(async (id) => serverState.find(e => e.id === id)),
      list: delayed(async () => [...serverState]),
      options: { auto: false },
      mutations: {},
      selectors: {},
    });

    const hook = renderHook(() => q.use());

    await hook.waitFor(() => {
      expect(hook.result.current.value).toMatchObject({
        data: [{ id: 1, value: "a" }, { id: 2, value: "b" }],
        initiated: true,
        loading: false,
        error: undefined,
      });
    });

    serverState[0] = { id: 1, value: "cd" };
    serverState[2] = { id: 3, value: "hello" };

    q.act.invalidate();
    expect(q.get()).toMatchObject({
      data: [{ id: 1, value: "a" }, { id: 2, value: "b" }],
      initiated: true,
      loading: true,
      error: undefined,
    });

    await hook.waitFor(() => {
      expect(hook.result.current.value).toMatchObject({
        data: [{ id: 1, value: "a" }, { id: 2, value: "b" }],
        initiated: true,
        loading: true,
        error: undefined,
      });
    });

    await hook.waitFor(() => {
      expect(hook.result.current.value).toMatchObject({
        data: [
          { id: 1, value: "cd" },
          { id: 2, value: "b" },
          { id: 3, value: "hello" },
        ],
        initiated: true,
        loading: false,
        error: undefined,
      });
    });
  });

  describe("custom mutations", () => {
    it("patch with return while get is mounted", async () => {
      const serverState = [
        { id: 1, value: "a" },
        { id: 2, value: "b" },
        { id: 3, value: "c" },
        { id: 4, value: "d" },
        { id: 5, value: "e" },
      ];

      const q = rest({
        id: entry => entry.id,
        get: delayed(async (id) => serverState.find(e => e.id === id)),
        list: delayed(async () => [...serverState]),
        options: { auto: false },
        selectors: {},
        mutations: {
          async patchElem(
            _,
            id: number,
            newValue: string,
            returnOverride?: { id: number; value: string },
          ) {
            const idx = serverState.findIndex(e => e.id === id);
            serverState[idx] = { id, value: newValue };
            await sleep(20);
            return returnOverride ?? serverState[idx];
          },
        },
      });

      const hook = renderHook(() => ({
        2: q.select.useGet(2),
        4: q.select.useGet(4),
      }));

      await hook.waitFor(() => {
        expect(hook.result.current[2].data).toMatchObject({
          id: 2,
          value: "b",
        });
        expect(hook.result.current[4].data).toMatchObject({
          id: 4,
          value: "d",
        });
      });

      await q.act.patchElem(2, "replaced");
      await hook.waitFor(() => {
        expect(hook.result.current[2].data).toMatchObject({
          id: 2,
          value: "replaced",
        });
        expect(hook.result.current[4].data).toMatchObject({
          id: 4,
          value: "d",
        });
      });

      await q.act.patchElem(4, "foobar", {
        id: 4,
        value: "upps, programmer error in mutation",
      });
      await hook.waitFor(() => {
        expect(hook.result.current[2].data).toMatchObject({
          id: 2,
          value: "replaced",
        });
        // whatever was returned by the mutation function
        expect(hook.result.current[4].data).toMatchObject({
          id: 4,
          value: "upps, programmer error in mutation",
        });
      });

      expect(q.select.get(4).data).toMatchObject({
        id: 4,
        value: "upps, programmer error in mutation",
      });

      q.act.invalidate(4);
      await hook.waitFor(() => {
        expect(hook.result.current[2].data).toMatchObject({
          id: 2,
          value: "replaced",
        });
        // on revalidate the correct elem is fetched
        expect(hook.result.current[4].data).toMatchObject({
          id: 4,
          value: "foobar",
        });
      });

      expect(q.select.get(4).data).toMatchObject({
        id: 4,
        value: "foobar",
      });
    });

    it("patch with return while list is mounted", async () => {
      const serverState = [
        { id: 1, value: "a" },
        { id: 2, value: "b" },
        { id: 3, value: "c" },
        { id: 4, value: "d" },
        { id: 5, value: "e" },
      ];

      const q = rest({
        id: entry => entry.id,
        get: delayed(async (id) => serverState.find(e => e.id === id)),
        list: delayed(async () => [...serverState]),
        options: { auto: false },
        selectors: {},
        mutations: {
          async patchElem(
            _,
            id: number,
            newValue: string,
            returnOverride?: { id: number; value: string },
          ) {
            const idx = serverState.findIndex(e => e.id === id);
            serverState[idx] = { id, value: newValue };
            await sleep(20);
            return returnOverride ?? serverState[idx];
          },
        },
      });

      const hook = renderHook(() => q.use());

      await hook.waitFor(() => {
        expect(hook.result.current.value.data).toMatchObject([
          { id: 1, value: "a" },
          { id: 2, value: "b" },
          { id: 3, value: "c" },
          { id: 4, value: "d" },
          { id: 5, value: "e" },
        ]);
      });

      await q.act.patchElem(1, "X");
      await q.act.patchElem(3, "Y", { id: 3, value: ":)" });
      await q.act.patchElem(5, "Z");
      await hook.waitFor(() => {
        expect(hook.result.current.value.data).toMatchObject([
          { id: 1, value: "X" },
          { id: 2, value: "b" },
          { id: 3, value: ":)" },
          { id: 4, value: "d" },
          { id: 5, value: "Z" },
        ]);
      });

      await q.act.invalidate();
      await hook.waitFor(() => {
        expect(hook.result.current.value.data).toMatchObject([
          { id: 1, value: "X" },
          { id: 2, value: "b" },
          { id: 3, value: "Y" },
          { id: 4, value: "d" },
          { id: 5, value: "Z" },
        ]);
      });
    });
  });

  describe("custom selectors", () => {
    it("fetches on mount a single element", async () => {
      const serverState = [
        { id: 1, value: "a" },
        { id: 2, value: "b" },
        { id: 3, value: "c" },
        { id: 4, value: "d" },
        { id: 5, value: "e" },
      ];

      const q = rest({
        id: entry => entry.id,
        get: delayed(async (id) => serverState.find(e => e.id === id)),
        list: delayed(async () => [...serverState]),
        options: { auto: false },
        mutations: {},
        selectors: {
          elementValues(state) {
            return state.data.map(elem => elem.value);
          },
          inIdRange: composeSelectors(
            (state, start: number, end: number) => state.data,
            (data, start, end) => {
              return data.slice(start, end);
            },
          ),
        },
      });

      const elementValues = renderHook(() => q.select.useElementValues());
      const inIdRange = renderHook(() => q.select.useInIdRange(1, 4));

      expect(elementValues.result.current).toEqual([]);
      expect(inIdRange.result.current).toEqual([]);

      await q.act.fetchList();

      await elementValues.waitFor(() => {
        expect(elementValues.result.current).toEqual([
          "a",
          "b",
          "c",
          "d",
          "e",
        ]);
      });

      await inIdRange.waitFor(() => {
        expect(inIdRange.result.current).toEqual([
          { id: 2, value: "b" },
          { id: 3, value: "c" },
          { id: 4, value: "d" },
        ]);
      });
    });
  });
});
