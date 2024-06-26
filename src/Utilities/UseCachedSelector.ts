import React from "react";
import type { QuarkContext, QuarkSelector } from "../Types";

const NULL_SYM = Symbol("null");

const DEFAULT_PORTAL = () => ({
  cache: {
    prevState: NULL_SYM as any,
    prevArgs: [] as any,
    prevResult: NULL_SYM as any,
  },
  selectorImpl: ((v: any) => v) as any,
  args: [] as any,
});

export const useCachedSelector = <T, ARGS extends any[], R>(
  selector: QuarkSelector<T, ARGS, R>,
  self: QuarkContext<T, any>,
  latestArgs: ARGS,
): () => R => {
  const [portal] = React.useState(
    DEFAULT_PORTAL as any as {
      cache: {
        prevState: typeof NULL_SYM | T;
        prevArgs: ARGS;
        prevResult: typeof NULL_SYM | R;
      };
      selectorImpl: typeof selector;
      args: typeof latestArgs;
    },
  );

  portal.args = latestArgs;
  portal.selectorImpl = selector;

  const [selectorWrapper] = React.useState(() => () => {
    const { args, selectorImpl } = portal;
    const { prevArgs, prevResult, prevState } = portal.cache;
    const state = self.value;

    if (
      prevResult === NULL_SYM
      || !Object.is(state, prevState)
      || !compareArrays(args, prevArgs)
    ) {
      const result = selectorImpl(state, ...args);

      portal.cache = {
        prevState: state,
        prevArgs: args,
        prevResult: result,
      };
    }

    return portal.cache.prevResult as R;
  });

  return selectorWrapper;
};

function compareArrays<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }

  return true;
}
