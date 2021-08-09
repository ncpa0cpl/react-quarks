import type { Quark } from "./Quark";

export type QuarkType<Q extends Quark<any, any>> = Q extends Quark<infer T, any>
  ? T
  : never;
