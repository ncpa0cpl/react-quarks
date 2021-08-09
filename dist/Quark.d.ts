import type { ParseActions, Quark, QuarkActions, QuarkConfig, QuarkEffects, QuarkMiddleware, QuarkObjectOptions, QuarkSelectors } from "./Types";
/**
 * Creates a new quark object.
 *
 * @param initValue Initial data of the quark.
 * @param config Config allows for adding custom actions and selectors to the quark
 *   as well as changing when subscribed component should update.
 * @param effects Allows for adding side effects to the quark, those effects will be
 *   performed after any change to the quark state. Effects take three arguments,
 *
 *   - [`arg_0`] - previous state
 *   - [`arg_1`] - new/current state
 *   - [`arg_2`] - all of the actions of the quark (including `set()`)
 */
export declare function quark<T, ARGS extends any[], A extends QuarkActions<T, ARGS>, S extends QuarkSelectors<T>, M extends QuarkMiddleware<T, any>[], E extends QuarkEffects<T, ParseActions<Exclude<A, undefined>>>>(initValue: T, config?: QuarkConfig<A, S, M>, effects?: E): Quark<T, QuarkObjectOptions<A, S, M, E>>;
