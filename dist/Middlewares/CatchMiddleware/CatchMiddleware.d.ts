import type { QuarkMiddleware } from "../../Types";
export declare function createCatchMiddleware(params?: {
    onCatch: (e: unknown) => void;
}): QuarkMiddleware<any, undefined>;
