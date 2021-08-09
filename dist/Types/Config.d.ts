import type { QuarkMiddleware } from "./Middlewares";
import type { QuarkComparatorFn } from "./Quark";
export declare type QuarkConfig<A, S, M extends QuarkMiddleware<any, any>[]> = {
    /**
     * This method defines when the subscribed component should update. It receives as
     * it's arguments the old quark state and the new state and returns a boolean.
     *
     * If the returned value is false the subscribed components won't be updated.
     *
     * Default logic is as follows:
     *
     * - If the value held in quark is a primitive updates are dispatched whenever the
     *   value changes (ie. when changing the state to the same value it's already at,
     *   nothing will happen).
     * - If the value held in quark is a reference (objects, arrays, etc.) updates are
     *   dispatched after every `set()` method call or after any custom action takes place.
     */
    shouldUpdate?: QuarkComparatorFn;
    /**
     * A dictionary of custom actions to be added to this quark.
     *
     * Each action should be a method that takes the quark state as it's first
     * argument, and any number of other arguments as you see fit.
     *
     * Each action must return a new state of the quark.
     *
     * @example
     *   const counter = quark(0, {
     *     actions: {
     *       increment(counterState) {
     *         return counterState + 1;
     *       },
     *       add(counterState, num: number) {
     *         return counterState + num;
     *       },
     *     },
     *   });
     *
     *   // with the above custom actions the following:
     *   counter.set((s) => s + 1); // increment by one
     *   counter.set((s) => s + 123); // add 123 to the counter
     *
     *   // can instead be done like this:
     *   counter.increment(); // increment by one
     *   counter.add(123); // add 123 to the counter
     */
    actions?: A;
    /**
     * Custom selectors allow for creating shortcuts for the `useSelector()` hook.
     *
     * Selectors defined here are similar to the selectors you would pass down to the
     * `useSelector()`, they should take the quark state as it's argument and return a
     * data derived from it.
     *
     * @example
     *   const pageSettings = quark(
     *     {
     *       title: "My Website",
     *       theme: "dark",
     *     },
     *     {
     *       selectors: {
     *         useSelectTitle(state) {
     *           return state.title;
     *         },
     *         useSelectTheme(state) {
     *           return state.theme;
     *         },
     *       },
     *     }
     *   );
     *
     *   function MyComponent() {
     *     const title = pageSettings.useSelectTitle();
     *     console.log(title.get()); // Output: "My Website"
     *   }
     */
    selectors?: S;
    middlewares?: M;
};
export declare type QuarkObjectOptions<A, S, M, E> = {
    shouldUpdate: QuarkComparatorFn;
    actions: A;
    selectors: S;
    effects: E;
    middlewares: M;
};
