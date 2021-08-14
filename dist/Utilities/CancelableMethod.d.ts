export declare function createCancelableMethod<A extends any[]>(method: (...args: A) => void): readonly [(...args: A) => void, () => void];
