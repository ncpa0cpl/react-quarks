"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToGlobalSpace = void 0;
function addToGlobalSpace(o) {
    if (window) {
        Object.assign(window, o);
    }
    else if (global && global.window) {
        Object.assign(global.window, o);
    }
    else if (global) {
        Object.assign(global, o);
    }
}
exports.addToGlobalSpace = addToGlobalSpace;
