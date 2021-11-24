"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unpackStateSetter = void 0;
const IsGenerator_1 = require("../IsGenerator");
const ApplyMiddlewares_1 = require("./ApplyMiddlewares");
/**
 * If the provided value is a Promise or a State Generator, resolve it and the pass
 * the received value to the middlewares and then "unpack" it again.
 *
 * If the provided value is of any other type, signal the async controller to cancel
 * ongoing updates and resolve the function passed to the `then()` method with the value.
 *
 * @param self Quark context
 * @param asyncUpdates Asynchronous updates controller
 * @param setter Value dispatched as an update to be unpacked
 * @internal
 */
function unpackStateSetter(self, asyncUpdates, setter) {
    if (setter instanceof Promise) {
        return {
            then(handler) {
                asyncUpdates.dispatchAsyncUpdate(setter, (state) => {
                    (0, ApplyMiddlewares_1.applyMiddlewares)(self, state, "async", (v) => unpackStateSetter(self, asyncUpdates, v).then(handler));
                });
            },
        };
    }
    if ((0, IsGenerator_1.isGenerator)(setter)) {
        const s = setter(self.value);
        return {
            then(handler) {
                (0, ApplyMiddlewares_1.applyMiddlewares)(self, s, "sync", (v) => {
                    unpackStateSetter(self, asyncUpdates, v).then(handler);
                });
            },
        };
    }
    asyncUpdates.preventLastAsyncUpdate();
    return {
        then(handler) {
            handler(setter);
        },
    };
}
exports.unpackStateSetter = unpackStateSetter;
