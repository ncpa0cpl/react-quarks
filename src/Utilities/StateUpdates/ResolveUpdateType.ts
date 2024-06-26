import { QuarkUpdateType, SetStateAction } from "../../Types";

export function resolveUpdateType(
  action: SetStateAction<any, any>
): QuarkUpdateType {
  if (action instanceof Promise) return "async";
  if (typeof action === "function") return "function";
  return "sync";
}
