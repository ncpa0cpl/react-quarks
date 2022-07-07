import { isEqual } from "lodash";
import React from "react";
import type { QuarkSelector } from "../Types";

const NULL_SYM = Symbol("null");

export const useCachedSelector = <T, ARGS extends any[], R>(
  selector: QuarkSelector<T, ARGS, R>
): QuarkSelector<T, ARGS, R> => {
  const cache = React.useRef({
    prevState: NULL_SYM as typeof NULL_SYM | T,
    prevArgs: [] as any as ARGS,
    prevResult: NULL_SYM as typeof NULL_SYM | R,
  });

  const impl = React.useRef(selector);
  impl.current = selector;

  const [selectorWrapper] = React.useState(() => (state: T, ...args: ARGS) => {
    if (
      cache.current.prevResult === NULL_SYM ||
      state !== cache.current.prevState ||
      !isEqual(args, cache.current.prevArgs)
    ) {
      const result = impl.current(state, ...args);

      cache.current.prevState = state;
      cache.current.prevArgs = args;
      cache.current.prevResult = result;
    }

    return cache.current.prevResult as R;
  });

  return selectorWrapper;
};
