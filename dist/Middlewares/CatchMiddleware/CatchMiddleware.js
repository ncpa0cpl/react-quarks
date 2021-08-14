export function createCatchMiddleware(params) {
    const onCatch = params?.onCatch ?? (() => { });
    return (prevState, value, resume) => {
        if (value instanceof Promise) {
            value.catch((e) => onCatch(e));
            return resume(value);
        }
        try {
            return resume(value);
        }
        catch (e) {
            return onCatch(e);
        }
    };
}
