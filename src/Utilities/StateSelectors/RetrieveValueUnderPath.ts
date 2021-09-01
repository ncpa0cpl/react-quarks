import type { ObjectPropTypes } from "../..";
import { hasKey, isRegularObject } from "../GeneralPurposeUtilities";

export function retrieveValueUnderPath(source: unknown, path: ObjectPropTypes[]) {
  return path.reduce(
    <K extends string | number | symbol>(acc: unknown, propName: K) => {
      if (isRegularObject(acc) && hasKey(acc, propName)) {
        return acc[propName];
      }
      return undefined;
    },
    source
  );
}
