"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEventsDispatcher = void 0;
function createEventsDispatcher() {
    let lastTimeout;
    const dispatchEvent = (eventAction) => {
        if (lastTimeout !== undefined) {
            window.clearTimeout(lastTimeout);
            lastTimeout = undefined;
        }
        lastTimeout = window.setTimeout(() => {
            lastTimeout = undefined;
            eventAction();
        }, 0);
    };
    return { dispatchEvent };
}
exports.createEventsDispatcher = createEventsDispatcher;
