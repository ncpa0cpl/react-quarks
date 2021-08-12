export function addToGlobalSpace(o: object) {
  if (window) {
    Object.assign(window, o);
  } else if (global && global.window) {
    Object.assign(global.window, o);
  } else if (global) {
    Object.assign(global, o);
  }
}
