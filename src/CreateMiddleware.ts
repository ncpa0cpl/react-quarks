import { QuarkMiddleware } from "./Types/Middlewares";

export function middleware<T>(m: QuarkMiddleware<T>): QuarkMiddleware<T> {
  return m;
}
