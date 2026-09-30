// Model settings editable from the web page. They are applied at once and
// kept for the next start (see ./env: .env on the server, localStorage in the
// online version).
import { z } from "zod";
import {
  JEV_PLATFORMS,
  JEV_PLATFORM_KEYS,
  callJev,
  callModel,
  config,
  parseJSON,
} from "./llm";
import { errorBody } from "./errors";
import { setEnv } from "./env";

export function publicConfig() {
  const c = config();
  // Enough to recognise which key is set, never enough to use it.
  const hint = (key: string) => (key ? `…${key.slice(-4)}` : "");
  return {
    provider: c.provider,
    configured: Boolean(c.apiKey),
    keyHint: hint(c.openaiKey),
    jevPlatform: c.jev.platform,
    /** Per platform, since each keeps its own key. */
    jevKeyHints: Object.fromEntries(
      Object.entries(c.jev.keys).map(([k, v]) => [k, hint(v)]),
    ),
    jevSuggest: c.jevSuggest,
    suggest: c.suggest,
    model: c.openaiModel,
    baseURL: c.baseURL,
    effort: c.effort,
    temperature: c.temperature ?? null,
    mask: c.mask,
    maskWords: c.maskWords.join("，"),
    cache: c.cache,
    parallel: c.parallel,
    rpm: c.rpm,
  };
}

// Values end up as single .env lines: no line breaks, quotes or spaces where
// they could smuggle in a second setting.
const plain = /^[^\s"'`]*$/;
export const settingsSchema = z.object({
  provider: z.enum(["openai", "jev"]).optional(),
  jevPlatform: z.enum(JEV_PLATFORM_KEYS).optional(),
  jevSuggest: z.boolean().optional(),
  jevApiKey: z.string().trim().max(300).regex(plain).optional(),
  apiKey: z.string().trim().max(300).regex(plain).optional(),
  model: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[\w.:\-/]+$/)
    .optional(),
  baseURL: z.string().trim().max(300).regex(plain).url().optional(),
  effort: z.enum(["", "minimal", "low", "medium", "high"]).optional(),
  temperature: z.number().min(0).max(2).nullable().optional(),
  mask: z.boolean().optional(),
  maskWords: z.string().max(2000).optional(),
  cache: z.boolean().optional(),
  parallel: z.number().int().min(1).max(64).optional(),
  /** 0 is no limit. */
  rpm: z.number().int().min(0).max(6000).optional(),
});

export async function updateConfig(patch: z.infer<typeof settingsSchema>) {
  const values: Record<string, string> = {};
  if (patch.provider !== undefined) values.LLM_PROVIDER = patch.provider;
  if (patch.jevPlatform !== undefined) values.JEV_PLATFORM = patch.jevPlatform;
  if (patch.jevSuggest !== undefined)
    values.JEV_SUGGEST = patch.jevSuggest ? "on" : "off";
  // A blank key field means "keep the current key", so it can't be erased by
  // accident. Each service keeps its own key, so switching back loses nothing.
  if (patch.apiKey?.trim()) values.OPENAI_API_KEY = patch.apiKey.trim();
  // A Jev key belongs to the platform chosen in the same form.
  if (patch.jevApiKey?.trim())
    values[JEV_PLATFORMS[patch.jevPlatform ?? config().jev.platform].keyEnv] =
      patch.jevApiKey.trim();
  if (patch.model !== undefined) values.OPENAI_MODEL = patch.model;
  if (patch.baseURL !== undefined)
    values.OPENAI_BASE_URL = patch.baseURL.replace(/\/+$/, "");
  if (patch.effort !== undefined) values.OPENAI_REASONING_EFFORT = patch.effort;
  if (patch.temperature !== undefined)
    values.OPENAI_TEMPERATURE =
      patch.temperature === null ? "" : String(patch.temperature);
  if (patch.mask !== undefined) values.PRIVACY_MASK = patch.mask ? "on" : "off";
  if (patch.maskWords !== undefined)
    values.MASK_WORDS = patch.maskWords
      .split(/[,，\n]/)
      .map((w) => w.trim())
      .filter(Boolean)
      .join(",");
  if (patch.cache !== undefined) values.LLM_CACHE = patch.cache ? "on" : "off";
  if (patch.parallel !== undefined) values.LLM_PARALLEL = String(patch.parallel);
  if (patch.rpm !== undefined) values.LLM_RPM = patch.rpm ? String(patch.rpm) : "";

  await setEnv(values);
  return publicConfig();
}

/** A minimal real request, to confirm the key, address and model all work. */
export async function testConnection(signal?: AbortSignal) {
  const start = performance.now();
  if (config().provider === "jev") {
    // Upstream's connection check: one question of each type on a tiny text.
    const reply = await callJev(
      {
        state: "This is a connection test. The sky is blue.",
        questions: {
          color: {
            type: "choice",
            instructions: "What color is the sky in the text?",
            criteria: { blue: null, red: null },
          },
          mentioned: {
            type: "noul",
            instructions: "Does the text mention the sky?",
          },
        },
      },
      signal,
    );
    const ok =
      (reply.answers.color as { type?: unknown } | undefined)?.type ===
      "choice";
    const latencyMs = Math.round(performance.now() - start);
    if (!ok || !config().suggest) return { ok, model: reply.model, latencyMs };
    // Jev + chat model: the reply-suggestion key must work too.
    try {
      const chat = await chatCheck(signal);
      return chat.ok
        ? { ok, model: reply.model, chatModel: chat.model, latencyMs }
        : { ok: false, ...errorBody("jevChatNoReply") };
    } catch (error) {
      console.error(
        "Reply-suggestion model check failed:",
        (error as { status?: number }).status ?? "network error",
      );
      return { ok: false, ...errorBody("jevChatFailed") };
    }
  }
  const chat = await chatCheck(signal);
  return { ...chat, latencyMs: Math.round(performance.now() - start) };
}

async function chatCheck(signal?: AbortSignal) {
  const reply = await callModel(
    [
      { role: "system", content: '只输出 JSON：{"ok": true}' },
      { role: "user", content: "测试连接" },
    ],
    signal,
  );
  return {
    ok: parseJSON(reply.content)?.ok === true,
    model: reply.model,
  };
}
