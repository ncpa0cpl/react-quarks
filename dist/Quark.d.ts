import type { GetMiddlewareTypes, Quark, QuarkActions, QuarkConfig, QuarkMiddleware, QuarkObjectOptions, QuarkSelectors, Rewrap, Widen } from "./Types";
/**
 * Creates a new quark object.
 *
 * @param initValue Initial data of the quark.
 * @param config Config allows for adding custom actions and selectors to the quark
 *   as well as changing when subscribed component should update.
 */
export declare function quark<T, A extends QuarkActions<T, GetMiddlewareTypes<M>, ActionArgs>, S extends QuarkSelectors<T, SelectorArgs>, M extends QuarkMiddleware<T, any>[] = never[], SelectorArgs extends any[] = never[], ActionArgs extends any[] = never[]>(initValue: T, config?: QuarkConfig<Widen<T>, A, S, M>): Rewrap<Quark<Widen<T>, QuarkObjectOptions<Widen<T>, A, S, M>>>;
