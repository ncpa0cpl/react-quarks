"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasKey = void 0;
/**
 * Check if the provided key is a property of the provided object and assert that
 * object type to allow the access to that property.
 *
 * @internal
 */
function hasKey(obj, key) {
    return key in obj;
}
exports.hasKey = hasKey;
