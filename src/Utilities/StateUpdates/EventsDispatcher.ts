type Microtask = ReturnType<typeof microtask>;

function microtask() {
  let action = () => {};
  let onStart = () => {};

  queueMicrotask(() => {
    onStart();
    action();
  });

  return {
    set(callback: () => void) {
      action = callback;
    },
    onStart(callback: () => void) {
      onStart = callback;
    },
  };
}

export function createEventsDebouncer(opts: { immediate?: boolean }) {
  if (opts.immediate) {
    return { debounceEvent: (action: () => void) => action() };
  }

  let lastMicrotask: Microtask | undefined;

  const debounceEvent = (action: () => void) => {
    if (!lastMicrotask) {
      lastMicrotask = microtask();
      lastMicrotask.onStart(() => {
        lastMicrotask = undefined;
      });
    }

    lastMicrotask.set(action);
  };

  return { debounceEvent };
}
