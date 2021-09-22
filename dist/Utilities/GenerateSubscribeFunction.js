"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSubscribeFunction = void 0;
function generateSubscribeFunction(self) {
    const subscribe = (onStateChange) => {
        const cancelSubscription = () => self.subscribers.delete(subscribeCallback);
        const subscribeCallback = (state) => {
            onStateChange(state, cancelSubscription);
        };
        self.subscribers.add(subscribeCallback);
        return {
            cancel() {
                cancelSubscription();
            },
        };
    };
    return subscribe;
}
exports.generateSubscribeFunction = generateSubscribeFunction;
