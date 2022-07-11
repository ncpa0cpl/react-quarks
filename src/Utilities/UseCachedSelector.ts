import { isEqual } from "lodash";
import React from "react";
import type { QuarkContext, QuarkSelector } from "../Types";

const NULL_SYM = Symbol("null");

export const useCachedSelector = <T, ARGS extends any[], R>(
  selector: QuarkSelector<T, ARGS, R>,
  self: QuarkContext<T, any>,
  latestArgs: ARGS
): (() => R) => {
  const portal = React.useRef({
    cache: {
      prevState: NULL_SYM as typeof NULL_SYM | T,
      prevArgs: [] as any as ARGS,
      prevResult: NULL_SYM as typeof NULL_SYM | R,
    },
    selectorImpl: selector,
    args: latestArgs,
  });

  portal.current.args = latestArgs;
  portal.current.selectorImpl = selector;

  const [selectorWrapper] = React.useState(() => () => {
    const { args, selectorImpl } = portal.current;
    const { prevArgs, prevResult, prevState } = portal.current.cache;
    const state = self.value;

    if (prevResult === NULL_SYM || state !== prevState || !isEqual(args, prevArgs)) {
      const result = selectorImpl(state, ...args);

      portal.current.cache = {
        prevState: state,
        prevArgs: args,
        prevResult: result,
      };
    }

    return portal.current.cache.prevResult as R;
  });

  return selectorWrapper;
};
