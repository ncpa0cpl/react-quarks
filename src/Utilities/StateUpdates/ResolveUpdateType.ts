import { DispatchSource, SetStateAction } from "../../Types/Quark";

export function resolveUpdateType(
  action: SetStateAction<any>,
): DispatchSource {
  if (action instanceof Promise) return "promise";
  if (typeof action === "function") return "function";
  return "value";
}
