"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancelUpdate = void 0;
const CANCEL_UPDATE_SYMBOL = Symbol();
/** A class that can be thrown within a Quark Action to prevent the update. */
class CancelUpdate {
    constructor() {
        this.identifier = CANCEL_UPDATE_SYMBOL;
    }
    static isCancel(e) {
        return (typeof e === "object" &&
            e !== null &&
            "identifier" in e &&
            e.identifier === CANCEL_UPDATE_SYMBOL);
    }
}
exports.CancelUpdate = CancelUpdate;
