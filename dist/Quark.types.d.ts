export declare type StateGenerator<T> = (oldVal: T) => T;
export declare type StateSetter<T> = StateGenerator<T> | T;
export declare type QuarkComparatorFn = (a: unknown, b: unknown) => boolean;
export declare type QuarkSetterFn<T> = (newVal: T | StateGenerator<T>) => void;
export declare type QuarkGetterFn<T> = () => T;
export declare type QuarkSelector<T, U> = (value: T) => U;
export declare type Quark<T, C extends {
    actions?: any;
    selectors?: any;
}> = {
    get(): T;
    set(newVal: StateSetter<T>): void;
    use(): {
        get(): T;
        set(newVal: StateSetter<T>): void;
    } & ParseActions<C["actions"]>;
    useSelector<U>(selector: QuarkSelector<T, U>): {
        get(): U | undefined;
    };
} & ParseActions<C["actions"]> & ParseSelectors<C["selectors"]>;
export declare type ParseSingleAction<A> = A extends (arg_0: any, ...args: infer ARGS) => infer R ? (...args: ARGS) => void : never;
export declare type ParseActions<A> = A extends object ? {
    [K in keyof A]: ParseSingleAction<A[K]>;
} : Record<string, unknown>;
export declare type ParseSingleSelector<S> = S extends (v: any) => infer R ? () => {
    get(): R;
} : never;
export declare type ParseSelectors<A> = A extends object ? {
    [K in keyof A]: ParseSingleSelector<A[K]>;
} : Record<string, unknown>;
export declare type QuarkCustomAction<T, ARGS extends any[]> = (quarkState: T, ...args: ARGS) => T;
export declare type QuarkActions<T, ARGS extends any[]> = Record<string, QuarkCustomAction<T, ARGS>>;
export declare type QuarkCustomSelector<T, R = any> = (quarkState: T) => R;
export declare type QuarkSelectors<T> = Record<string, QuarkCustomSelector<T>>;
export declare type QuarkCustomEffect<T, A> = (previousState: T, newState: T, stateActions: A & {
    set: QuarkSetterFn<T>;
}) => void;
export declare type QuarkEffects<T, A> = Record<string, QuarkCustomEffect<T, A>>;
export declare type QuarkType<Q extends Quark<any, any>> = Q extends Quark<infer T, any> ? T : never;
