// Error replies carry a stable code the page translates into its language,
// plus the Chinese text for anything that reads the reply without the page.
import { zh } from "../src/locales/zh";

type Errors = typeof zh.errors;
export type ErrorCode = {
  [K in keyof Errors]: Errors[K] extends string ? K : never;
}[keyof Errors];

export const errorBody = (code: ErrorCode) => ({
  error: zh.errors[code] as string,
  code,
});

// Upstream statuses that have their own advice. The same statuses mean
// different fixes on Jev, whose settings have no model name or address.
const HTTP_CODES = [400, 401, 402, 403, 404, 413, 422, 429, 529];
const JEV_CODES = [400, 401, 402, 403, 404, 502];
export function errorCode(
  status: number,
  detail?: string,
  jev = false,
): ErrorCode {
  if (jev && JEV_CODES.includes(status)) return `jev${status}` as ErrorCode;
  if (HTTP_CODES.includes(status)) return `http${status}` as ErrorCode;
  return status === 502 && detail === "network error"
    ? "network"
    : "unfinished";
}
