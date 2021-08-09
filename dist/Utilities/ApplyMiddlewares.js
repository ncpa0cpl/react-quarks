export function applyMiddlewares(self, value, setterFn) {
    const middlewares = self.middlewares;
    const applyMiddlewareOfIndex = (index, v) => {
        const nextMiddleware = middlewares[index];
        if (nextMiddleware) {
            nextMiddleware(self.value, value, (resumedValue) => applyMiddlewareOfIndex(index + 1, resumedValue), setterFn);
        }
        else {
            setterFn(v);
        }
    };
    applyMiddlewareOfIndex(0, value);
}
