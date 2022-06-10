import serialize from "serialize-javascript";
import type { QuarkContext } from "../Types";

function deserialize(serializedJavascript: string) {
  return eval("(" + serializedJavascript + ")");
}

const quarkCollection = new Map<string, QuarkContext<unknown, any>>();

export const registerQuark = (name: string, context: QuarkContext<any, any>) => {
  if (quarkCollection.has(name)) {
    throw new Error(`Quark name must be unique! Duplicate name: [${name}]`);
  }

  quarkCollection.set(name, context);
};

/** Serializes all named quarks. */
export const serializeQuarks = () => {
  return JSON.stringify(
    serialize(
      [...quarkCollection.entries()].map(([name, context]) => [name, context.value]),
      { ignoreFunction: true }
    )
  );
};

/**
 * Deserializes named quarks and updates the state of each included named quark with
 * the state from the serialized data.
 */
export const hydrateQuarks = (
  serializedQuarks: string,
  options?: { skipMissingQuarks?: boolean }
) => {
  const { skipMissingQuarks = false } = options ?? {};
  const data: Array<[string, unknown]> = deserialize(JSON.parse(serializedQuarks));

  for (const [name, value] of data) {
    const context = quarkCollection.get(name);

    if (!context) {
      if (skipMissingQuarks) continue;
      throw new Error(
        `Quark does not exist. Unable to hydrate. Missing quark: [${name}]`
      );
    }

    context.value = value;

    for (const sub of context.subscribers) {
      sub(context.value);
    }
  }
};
