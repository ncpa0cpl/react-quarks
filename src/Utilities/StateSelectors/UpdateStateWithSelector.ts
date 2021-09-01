import type { QuarkSelector, QuarkSetterFn } from "../..";

export function updateStateWithSelector<T, ET, U>(
  set: QuarkSetterFn<T, ET>,
  selector: QuarkSelector<T, U>,
  value: U
) {}
