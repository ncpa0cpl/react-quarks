/**
 * Check if the provided key is a property of the provided object and assert that
 * object type to allow the access to that property.
 *
 * @internal
 */
export function hasKey(obj, key) {
    return key in obj;
}
