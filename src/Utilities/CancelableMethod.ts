export function createCancelableMethod<A extends any[]>(
  method: (...args: A) => void
) {
  let isEnabled = true;
  const wrappedMethod = (...args: A) => {
    if (isEnabled) method(...args);
  };
  const cancel = () => {
    isEnabled = false;
  };
  return [wrappedMethod, cancel] as const;
}
