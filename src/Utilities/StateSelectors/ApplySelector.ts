import type { QuarkCustomSelector, QuarkSelector } from "../..";
import { retrievePath } from "./RetrieveSelectorProxyPath";
import { retrieveValueUnderPath } from "./RetrieveValueUnderPath";
import { createProxySelector } from "./SelectorProxy";

export function applySelector<T, R>(value: T, selector: QuarkSelector<T, R>): R {
  const selectorPath = retrievePath(selector(createProxySelector()));
  const pathValue = retrieveValueUnderPath(value, selectorPath);

  return pathValue as any;
}

export function applyCustomSelector<T, R, ARGS extends any[]>(
  value: T,
  selector: QuarkCustomSelector<T, ARGS, R>,
  ...args: ARGS
): R {
  const selectorPath = retrievePath(selector(createProxySelector(), ...args));
  const pathValue = retrieveValueUnderPath(value, selectorPath);

  return pathValue as any;
}
