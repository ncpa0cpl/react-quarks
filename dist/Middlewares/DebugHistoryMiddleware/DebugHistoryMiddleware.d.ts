import type { QuarkMiddleware } from "../../Types";
export declare function createDebugHistoryMiddleware(options: {
    name: string;
    trace?: boolean;
}): QuarkMiddleware<any, undefined>;
