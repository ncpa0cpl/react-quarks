"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.entryToReadableForm = void 0;
const luxon_1 = require("luxon");
const GeneralPurposeUtilities_1 = require("../../Utilities/GeneralPurposeUtilities");
const PROPERTIES_FRIENDLY_NAMES_MAP = {
    value: "Value:",
    type: "Value Type:",
    change: "Value Change is:",
    initialState: "Previous state value:",
    dispatchedUpdate: "Dispatched state value:",
    name: "Quark Name:",
    source: "Update Source:",
    stackTrace: "Stack Trace:",
    stateAfterUpdate: "Next state value:",
    time: "Timestamp:",
    isCanceled: "Canceled:",
};
const columns = [
    "initialState",
    "dispatchedUpdate",
    "stateAfterUpdate",
    "isCanceled",
    "change",
    "source",
    "time",
    "stackTrace",
];
function stringifyIfObject(v) {
    if (typeof v === "object") {
        if (v instanceof Promise)
            return "Promise {}";
        if (v !== null)
            return JSON.stringify(v);
        return "null";
    }
    return v;
}
function parseObjectValue(obj) {
    if ("type" in obj && "value" in obj)
        return `Type: ${obj.type}; Value: [${stringifyIfObject(obj.value)}]`;
    return `Type: Value; Value: [${stringifyIfObject(obj)}]`;
}
function entryToReadableForm(entry) {
    const columnValues = columns.map((propertyName) => {
        const friendlyName = PROPERTIES_FRIENDLY_NAMES_MAP[propertyName];
        const value = (0, GeneralPurposeUtilities_1.hasKey)(entry, propertyName)
            ? entry[propertyName]
            : undefined;
        if (typeof value === "object") {
            return [friendlyName, parseObjectValue(value)];
        }
        if (propertyName === "time") {
            return [friendlyName, luxon_1.DateTime.fromMillis(value).toISO()];
        }
        if (propertyName === "isCanceled") {
            return [friendlyName, !!value];
        }
        return [friendlyName, value];
    });
    return Object.fromEntries(columnValues);
}
exports.entryToReadableForm = entryToReadableForm;
