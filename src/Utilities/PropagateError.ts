export const propagateError = (e: unknown, message: string) => {
  let originalMessage: string | null = null;

  if (e instanceof Error) {
    originalMessage = e.message;
  }

  return new Error(
    `${message}${originalMessage ? ` [${originalMessage}]` : ""}`,
    {
      cause: e,
    },
  );
};
