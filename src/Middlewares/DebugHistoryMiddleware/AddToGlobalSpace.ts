declare const global: any;

export function addToGlobalSpace(o: object) {
  if (typeof window !== "undefined") {
    Object.assign(window, o);
  } else if (
    typeof global !== "undefined" && typeof global.window !== "undefined"
  ) {
    Object.assign(global.window, o);
  } else if (typeof globalThis !== "undefined") {
    Object.assign(globalThis, o);
  } else if (typeof global !== "undefined") {
    Object.assign(global, o);
  }
}
