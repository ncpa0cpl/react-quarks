export function createCancelableMethod(method) {
    let isEnabled = true;
    const wrappedMethod = (...args) => {
        if (isEnabled)
            method(...args);
    };
    const cancel = () => {
        isEnabled = false;
    };
    return [wrappedMethod, cancel];
}
