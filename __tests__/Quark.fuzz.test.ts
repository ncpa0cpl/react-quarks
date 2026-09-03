import { beforeAll, describe, expect, it } from "vitest";
import {
  addGlobalQuarkMiddleware,
  createImmerMiddleware,
  quark,
} from "../src/index";
import { sleep } from "./helpers";

type Category = { id: number; name: string };
type Video = { id: number; categories: Category[] };

/**
 * Small deterministic PRNG (mulberry32), so a failing run can be replayed
 * exactly by re-running the test with the same FUZZ_SEED env variable.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ITERATIONS = 500;

describe("fuzz: concurrent async generator actions (queue mode + immer middleware)", () => {
  beforeAll(() => {
    addGlobalQuarkMiddleware(createImmerMiddleware({ arrayMethods: true }));
  });

  /**
   * Mirrors the `addCategory` action as used in the app: optimistic update
   * with a rollback on API failure. The `shouldFail` argument simulates the
   * API outcome.
   */
  function makeVideosQuark(videos: Video[], rng: () => number) {
    const rnd = (min: number, max: number) =>
      Math.floor(rng() * (max - min + 1)) + min;

    return quark(
      { data: videos },
      {
        mode: "queue",
        actions: {
          async *addCategory(
            api,
            videoID: number,
            newCategory: Category,
            shouldFail: boolean,
          ) {
            const videoIdx = api.get().data.findIndex(v => v.id === videoID);
            const original = api.get().data[videoIdx].categories;

            yield api.assign(
              (s: any) => s.data[videoIdx],
              { categories: [...original, newCategory] },
            );

            try {
              const st = rnd(0, 25);
              if (st > 3) {
                await sleep(st);
              }
              if (shouldFail) {
                throw new Error("simulated api failure");
              }
            } catch (e) {
              yield api.assign(
                (s: any) => s.data[videoIdx],
                { categories: original },
              );
            }

            return api.noop();
          },
        },
      },
    );
  }

  it(
    "concurrent addCategory calls never lose categories that were added "
      + "successfully and never keep categories whose api call failed",
    async () => {
      const seed = process.env.FUZZ_SEED != null
        ? Number(process.env.FUZZ_SEED)
        : Math.floor(Math.random() * 2 ** 31);
      const rng = mulberry32(seed);
      const rnd = (min: number, max: number) =>
        Math.floor(rng() * (max - min + 1)) + min;

      let iter = 0;
      let calls: {
        videoID: number;
        category: Category;
        shouldFail: boolean;
      }[] = [];

      try {
        for (iter = 0; iter < ITERATIONS; iter++) {
          const videoCount = rnd(1, 10);
          const videos: Video[] = Array.from(
            { length: videoCount },
            (_, i) => ({
              id: i + 1,
              // random pre-existing state
              categories: Array.from({ length: rnd(0, 5) }, (_, c) => ({
                id: -(iter * 100 + c),
                name: `seed-${i}-${c}`,
              })),
            }),
          );

          const q = makeVideosQuark(videos, rng);

          const callCount = rnd(2, 10);
          calls = Array.from({ length: callCount }, (_, c) => ({
            videoID: rnd(1, videoCount),
            category: { id: iter * 1000 + c, name: `cat-${iter}-${c}` },
            shouldFail: rng() < 0.3,
          }));

          // dispatch all calls "simultaneously" in the same tick (worst case),
          // occasionally staggered with small random delays instead
          const stagger = rng() > 0.3;
          const promises = calls.map(call => {
            const p = q.act.addCategory(
              call.videoID,
              call.category,
              call.shouldFail,
            );
            return stagger ? sleep(rnd(0, 20)).then(() => p) : p;
          });

          await Promise.all(promises);

          const expected = new Map<number, Category[]>();
          for (const video of videos) {
            expected.set(video.id, [...video.categories]);
          }
          for (const call of calls) {
            if (!call.shouldFail) {
              expected.get(call.videoID)!.push(call.category);
            }
          }

          for (const video of q.get().data) {
            // every successfully added category must be present exactly once,
            // every rolled back category must be absent, and any other video's
            // categories must be untouched
            expect(video.categories).toEqual(expected.get(video.id));
          }
        }
      } catch (err) {
        const info =
          `fuzz failed (seed: ${seed}, iteration: ${iter}) - re-run with FUZZ_SEED=${seed}`;
        console.error(`[fuzz] ${info}`);
        console.error(`[fuzz] calls: ${JSON.stringify(calls)}`);
        if (err instanceof Error) {
          err.message = `${info} - ${err.message}`;
          throw err;
        }
        throw new Error(`${info} - ${String(err)}`);
      }
    },
    Math.max(5_000, 10_000 * ITERATIONS / 100), // 100 iters takes ~10s
  );
});
