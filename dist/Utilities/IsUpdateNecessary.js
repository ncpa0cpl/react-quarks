/**
 * @internal
 */
export function isUpdateNecessary(_old, _new) {
    return typeof _new === "object" ? true : !Object.is(_old, _new);
}
