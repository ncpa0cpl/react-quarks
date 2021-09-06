import { generateSelectHook } from ".";
/** @internal */
function generatePredefinedSelectHook(self, selector) {
    const hook = generateSelectHook(self);
    return (...args) => hook(selector, ...args);
}
/**
 * Generate `selector` React Hooks based on the selectors defined in the Quark config.
 *
 * @param self Context of the Quark in question
 * @param selectors An object containing selector definitions, each selector must be
 *   a function accepting the Quark state value in it's first argument
 * @returns An object with the same structure as `selectors` but each method it
 *   contains is a React Hook
 * @internal
 */
export function generateCustomSelectors(self, selectors) {
    return Object.fromEntries(Object.entries(selectors).map(([selectorName, selectorMethod]) => {
        const wrappedSelector = generatePredefinedSelectHook(self, selectorMethod);
        return [selectorName, wrappedSelector];
    }));
}
