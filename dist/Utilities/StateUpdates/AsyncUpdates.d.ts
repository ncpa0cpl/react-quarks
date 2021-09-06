/**
 * Check if the passed promise has been dispatched to the Quark as update and canceled.
 *
 * If the provided promise has not been ever dispatched as update `undefined` will be returned.
 *
 * @param promise A Promise class instance
 * @returns A boolean
 */
export declare function extractIsPromiseCanceled(promise: unknown): boolean | undefined;
