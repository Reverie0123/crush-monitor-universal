// The online demo: a static build (GitHub Pages) with no server and no key.
// It opens on a sample chat that was analyzed ahead of time with a real model
// (src/demo/*.json, made by scripts/make-demo.ts); anything that would call
// the model says it is a demo instead.
import type { SavedConversation } from "./storage";
import { currentLang, messages } from "./i18n";

export const DEMO = __DEMO__;
export const REPO_URL =
  "https://github.com/Reverie0123/crush-monitor-universal";

/** The pre-analyzed sample chat in the interface language. */
export async function demoConversation(): Promise<SavedConversation> {
  const data =
    currentLang() === "en"
      ? await import("./demo/en.json")
      : await import("./demo/zh.json");
  return data.default as unknown as SavedConversation;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Stands in for the server: settings read as a DeepSeek setup, the rest declines. */
export function demoFetch(path: string, init: RequestInit = {}) {
  if (path === "/api/config" && (init.method ?? "GET") === "GET")
    return json({
      provider: "openai",
      configured: true,
      keyHint: "demo",
      jevPlatform: "openrouter",
      jevKeyHints: { typesafe: "", openrouter: "", vercel: "" },
      jevSuggest: false,
      suggest: true,
      model: "deepseek-chat",
      baseURL: "https://api.deepseek.com/v1",
      effort: "",
      temperature: null,
      mask: true,
      maskWords: "",
      cache: true,
    });
  return json({ error: messages().errors.demo, code: "demo" }, 503);
}
