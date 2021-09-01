import type { SelectorBasicReturnType, SelectorProxy } from "../..";
import { hasKey, isRegularObject } from "../GeneralPurposeUtilities";
import { PATH_SYMBOL } from "./SelectorProxy";

export function retrievePath(
  selector: SelectorProxy<any> | SelectorBasicReturnType<any>
) {
  if (isRegularObject(selector) && hasKey(selector, PATH_SYMBOL)) {
    return selector[PATH_SYMBOL];
  }
  throw new Error("Provided value is not a Selector Proxy.");
}
