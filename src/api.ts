import { API_VERSION } from "../shared/types";
import { DEMO, demoFetch } from "./demo";

/** fetch() for this app's API, tagged with the page version so a stale server can say so. */
export function apiFetch(path: string, init: RequestInit = {}) {
  if (DEMO) return Promise.resolve(demoFetch(path, init));
  const headers = new Headers(init.headers);
  headers.set("X-Api-Version", API_VERSION);
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  return fetch(path, { ...init, headers });
}
