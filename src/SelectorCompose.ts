import { createCachedSelector } from "./Utilities/CreateCachedSelector";

export function composeSelectors<S, R1, R2, A extends any[]>(
  selector1: (s: S, ...args: A) => R1,
  selector2: (r1: R1, ...args: A) => R2
): (s: S, ...args: A) => R2;
export function composeSelectors<S, R1, R2, R3, A extends any[]>(
  selector1: (s: S, ...args: A) => R1,
  selector2: (s: S, ...args: A) => R2,
  selector3: (r1: R1, r2: R2, ...args: A) => R3
): (s: S, ...args: A) => R3;
export function composeSelectors<S, R1, R2, R3, R4, A extends any[]>(
  selector1: (s: S, ...args: A) => R1,
  selector2: (s: S, ...args: A) => R2,
  selector3: (s: S, ...args: A) => R3,
  selector4: (r1: R1, r2: R2, r3: R3, ...args: A) => R4
): (s: S, ...args: A) => R4;
export function composeSelectors<S, R1, R2, R3, R4, R5, A extends any[]>(
  selector1: (s: S, ...args: A) => R1,
  selector2: (s: S, ...args: A) => R2,
  selector3: (s: S, ...args: A) => R3,
  selector4: (s: S, ...args: A) => R4,
  selector5: (r1: R1, r2: R2, r3: R3, r4: R4, ...args: A) => R5
): (s: S, ...args: A) => R5;
export function composeSelectors<S, R1, R2, R3, R4, R5, R6, A extends any[]>(
  selector1: (s: S, ...args: A) => R1,
  selector2: (s: S, ...args: A) => R2,
  selector3: (s: S, ...args: A) => R3,
  selector4: (s: S, ...args: A) => R4,
  selector5: (s: S, ...args: A) => R5,
  selector6: (r1: R1, r2: R2, r3: R3, r4: R4, r5: R5, ...args: A) => R6
): (s: S, ...args: A) => R6;
export function composeSelectors(
  ...selectors: Array<(v: any, ...args: any[]) => any>
): any {
  selectors = selectors.map(createCachedSelector);

  const depSelectors = selectors.slice(0, selectors.length - 1);
  const resultSelector = selectors[selectors.length - 1];

  return (state: any, ...args: any[]) => {
    const rs: any[] = [];
    for (let i = 0; i < depSelectors.length; i++) {
      rs.push(depSelectors[i](state, ...args));
    }
    // @ts-ignore
    return resultSelector(...rs, ...args);
  };
}
