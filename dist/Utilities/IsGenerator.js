"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isGenerator = void 0;
/**
 * Determine if the passed value is a State Generator.
 *
 * A State Generator is a method that receives the current Quark State value and
 * returns the new value or a Promise resolving the new value.
 *
 * @internal
 */
function isGenerator(v) {
    return typeof v === "function";
}
exports.isGenerator = isGenerator;
