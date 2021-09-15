export function createEventsDispatcher() {
  let lastTimeout: number | undefined;

  const dispatchEvent = (eventAction: () => void) => {
    if (lastTimeout !== undefined) {
      window.clearTimeout(lastTimeout);
      lastTimeout = undefined;
    }

    lastTimeout = window.setTimeout(() => {
      lastTimeout = undefined;
      eventAction();
    }, 0);
  };

  return { dispatchEvent };
}
