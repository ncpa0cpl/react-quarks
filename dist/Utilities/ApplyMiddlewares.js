export function applyMiddlewares(self, value, setterFn) {
    const applyMiddlewareOfIndex = (index, v) => {
        const nextMiddleware = self.middlewares[index];
        if (nextMiddleware) {
            nextMiddleware(() => self.value, v, (resumedValue) => applyMiddlewareOfIndex(index + 1, resumedValue), setterFn);
        }
        else {
            setterFn(v);
        }
    };
    applyMiddlewareOfIndex(0, value);
}
