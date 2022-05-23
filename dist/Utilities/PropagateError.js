"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.propagateError = void 0;
const propagateError = (e, message) => {
    let originalMessage = null;
    if (e instanceof Error) {
        originalMessage = e.message;
    }
    // @ts-expect-error
    return new Error(`${message}${originalMessage ? ` [${originalMessage}]` : ""}`, {
        cause: e,
    });
};
exports.propagateError = propagateError;
