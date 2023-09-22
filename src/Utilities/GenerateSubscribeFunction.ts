import type { QuarkContext } from "..";

export function generateSubscribeFunction<T, ET>(self: QuarkContext<T, ET>) {
  const subscribe = (
    onStateChange: (state: T, cancelSubscription: () => void) => void,
  ) => {
    const cancelSubscription = () => self.subscribers.delete(subscribeCallback);

    const subscribeCallback = (state: T) => {
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
