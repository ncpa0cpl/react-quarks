import type serializejs from "serialize-javascript";
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

/**
 * Serializes all named quarks. Use to serialize the quark states on the server, when
 * using SSR, and send them to the client for hydration.
 *
 * This functions requires `serialize-javascript` package, and as a result can only
 * be used in Node environments.
 */
export const serializeQuarks = () => {
  // obfuscate module name, so the compiler won't try to include this module in browser bundle
  const serializeJavascriptMdouleName = ["serialize", "javascript"].join("-");
  // eslint-disable-next-line
  const serialize: typeof serializejs = require(serializeJavascriptMdouleName);
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
