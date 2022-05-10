import React from "react";

export const useDynamicDependencies = (deps: unknown[]) => {
  const lastDepResult = React.useRef(0);
  const prevDeps = React.useRef(deps);

  if (deps.length !== prevDeps.current.length) {
    lastDepResult.current = (lastDepResult.current + 1) % 1000;
  } else if (deps.some((elem, index) => !Object.is(elem, prevDeps.current[index]))) {
    lastDepResult.current = (lastDepResult.current + 1) % 1000;
  }

  prevDeps.current = deps;

  return lastDepResult.current;
};
