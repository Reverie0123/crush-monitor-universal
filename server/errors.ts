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
