"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancelUpdate = exports.quark = void 0;
__exportStar(require("./Middlewares"), exports);
var Quark_1 = require("./Quark");
Object.defineProperty(exports, "quark", { enumerable: true, get: function () { return Quark_1.quark; } });
__exportStar(require("./Types/index"), exports);
var CancelUpdate_1 = require("./Utilities/CancelUpdate");
Object.defineProperty(exports, "CancelUpdate", { enumerable: true, get: function () { return CancelUpdate_1.CancelUpdate; } });
