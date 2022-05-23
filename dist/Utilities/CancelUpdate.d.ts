/** A class that can be thrown within a Quark Action to prevent the update. */
export declare class CancelUpdate {
    static isCancel(e: unknown): boolean;
    readonly identifier: symbol;
}
