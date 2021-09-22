"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUpdateNecessary = void 0;
/**
 * Compare old ans new state value and determine if the substituents should receive
 * `STATE CHANGED` event.
 *
 * This is the method that's used by the Quarks by default.
 *
 * @internal
 */
function isUpdateNecessary(_old, _new) {
    return typeof _new === "object" ? true : !Object.is(_old, _new);
}
exports.isUpdateNecessary = isUpdateNecessary;
