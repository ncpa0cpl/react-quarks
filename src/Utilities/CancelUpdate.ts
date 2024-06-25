const CANCEL_UPDATE_SYMBOL = Symbol();

/**
 * A class that can be thrown within a Quark Action to prevent the update.
 */
export class CancelUpdate {
  static isCancel(e: unknown) {
    return (
      typeof e === "object"
      && e !== null
      && "identifier" in e
      && (e as { identifier: unknown }).identifier === CANCEL_UPDATE_SYMBOL
    );
  }

  readonly identifier = CANCEL_UPDATE_SYMBOL;
}
