import type { GetMiddlewareTypes, QuarkCustomEffect } from ".";
import type { QuarkMiddleware } from "./Middlewares";
import type { QuarkComparatorFn } from "./Quark";
export declare type QuarkConfig<T, A, S, M extends QuarkMiddleware<any, any>[]> = {
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
    /**
     * List of middleware methods that will be called on each dispatch, middleware
     * receives the dispatched update before the Quark state is updates, it has the
     * ability to modify that value, or prevent the update.
     *
     * A middleware is provided with 5 argument:
     *
     * - `arg_0` - getState(): T - method which return the current Quark state value
     * - `arg_1` - action - dispatched value, this is the same as what is provided to the
     *   `.set()` method
     * - `arg_2` - resume(v: T) - this method will resume the standard update flow, value
     *   provided to it will be forwarded to the next middleware
     * - `arg_3` - set(v: T) - this method allows to break from the standard update flow
     *   and set the state immediately
     * - `arg_4` - updateType - QuarkUpdateType
     *
     * A middleware can be called multiple times for each single update, if the
     * dispatched value is a Generator or a Promise, it will call the middleware with
     * that Promise/Generator, unpack the value and call it again, then if the unpacked
     * value is a again a Generator or a Promise it's unpacked once more and
     * midllewares are called again, this repeats until a value that's not a promise or
     * a function gets resolved.
     */
    middlewares?: M;
    /**
     * Side effect function that will execute after every quark update.
     *
     * An effect takes up to three arguments:
     *
     * - `arg_0` - previous state
     * - `arg_1` - current state
     * - `arg_2` - `set()` function that can be used to update the quark value
     *
     * BEWARE! Calling `set()` within the effect can lead to an infinite loop if you
     * are not careful. `set()` should only be called within an effect under specific
     * conditions.
     */
    effect?: QuarkCustomEffect<T, GetMiddlewareTypes<M>>;
    /**
     * By default asynchronous state updates are canceled if another update is
     * dispatched later on, this allows for avoiding race conditions. You can opt-out
     * of this behavior by setting this option to `true`.
     */
    allowRaceConditions?: boolean;
};
export declare type QuarkObjectOptions<T, A, S, M extends QuarkMiddleware<any, any>[]> = {
    shouldUpdate: QuarkComparatorFn;
    actions: A;
    selectors: S;
    effect: QuarkCustomEffect<T, GetMiddlewareTypes<M>>;
    middlewares: M;
};
