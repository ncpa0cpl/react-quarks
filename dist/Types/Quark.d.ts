import type { ParseActions } from "./Actions";
import type { GetMiddlewareTypes } from "./Middlewares";
import type { ParseSelectors, QuarkSelector } from "./Selectors";
export declare type StateGenerator<T> = (oldVal: T) => T;
export declare type InternalStateSetter<T> = StateGenerator<T> | T;
export declare type StateSetter<T, ET> = InternalStateSetter<T> | ET;
export declare type QuarkComparatorFn = (a: unknown, b: unknown) => boolean;
export declare type QuarkSetterFn<T> = (newVal: T | StateGenerator<T>) => void;
export declare type QuarkGetterFn<T> = () => T;
export declare type Quark<T, C extends {
    actions?: any;
    selectors?: any;
    middlewares?: any;
}> = {
    /** Retrieves the data held in the quark. */
    get(): T;
    /**
     * Updates the data held in the quark.
     *
     * @param newVal A new data or a function that takes the previous state of the
     *   quark and returns a new one.
     */
    set(newVal: StateSetter<T, GetMiddlewareTypes<C["middlewares"]>>): void;
    /**
     * React hook to access the data in the quark. It can be only used within React
     * functional components.
     *
     * Changes to the quark state will cause the functional component to re-render.
     *
     * This method returns two functions:
     *
     * - `get()` - to access the data
     * - `set()` - to updated the data
     */
    use(): {
        get(): T;
        set(newVal: StateSetter<T, GetMiddlewareTypes<C["middlewares"]>>): void;
    } & ParseActions<C["actions"]>;
    /**
     * React hook to access a part of the data within the quark or to retrieve it and transform.
     *
     * This hook will only cause component updates if the result of the `selector()`
     * function changes.
     *
     * How the `selector()` function return value is evaluated can be adjusted by
     * passing a comparator method as the second argument.
     *
     * IMPORTANT!
     *
     * Avoid passing a new `selector` function on every render, use the React
     * useCallback hook to memoize the selector or define it outside your component.
     *
     * @example
     *   const myQuark = quark(["Hello", "World"]);
     *
     *   const selectFirstWord = (state) => state[0];
     *
     *   function MyComponent() {
     *     const firstWord = myQuark.useSelector(selectFirstWord);
     *     console.log(firstWord.get()); // Output: "Hello"
     *   }
     */
    useSelector<U>(selector: QuarkSelector<T, U>, shouldComponentUpdate?: QuarkComparatorFn): {
        get(): U | undefined;
    };
} & ParseActions<C["actions"]> & ParseSelectors<C["selectors"]>;
