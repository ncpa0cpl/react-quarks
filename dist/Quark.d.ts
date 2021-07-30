import type { ParseActions, Quark, QuarkActions, QuarkComparatorFn, QuarkEffects, QuarkSelectors } from "./Quark.types";
export declare function quark<T, ARGS extends any[], A extends QuarkActions<T, ARGS>, S extends QuarkSelectors<T>, E extends QuarkEffects<T, ParseActions<Exclude<A, undefined>>>>(initValue: T, config?: {
    shouldUpdate?: QuarkComparatorFn;
    actions?: A;
    selectors?: S;
}, effects?: E): Quark<T, {
    shouldUpdate: QuarkComparatorFn;
    actions: A;
    selectors: S;
    effects: E;
}>;
