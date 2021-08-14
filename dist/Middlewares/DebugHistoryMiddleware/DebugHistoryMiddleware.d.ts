import type { QuarkMiddleware } from "../../Types";
export declare function createDebugHistoryMiddleware(options: {
    name: string;
    trace?: boolean;
    realTimeLogging?: boolean;
    useTablePrint?: boolean;
}): QuarkMiddleware<any, undefined>;
