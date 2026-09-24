// Model settings editable from the web page. Values live in .env so they
// survive restarts, and are applied to process.env so they take effect at once.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { callModel, config, parseJSON } from "./llm";

const ENV_PATH = join(process.cwd(), ".env");

export function publicConfig() {
  const c = config();
  return {
    configured: Boolean(c.apiKey),
    // Enough to recognise which key is set, never enough to use it.
    keyHint: c.apiKey ? `…${c.apiKey.slice(-4)}` : "",
    model: c.model,
    baseURL: c.baseURL,
    effort: c.effort,
    temperature: c.temperature ?? null,
    mask: c.mask,
    maskWords: c.maskWords.join("，"),
    cache: c.cache,
  };
}

// Values end up as single .env lines: no line breaks, quotes or spaces where
// they could smuggle in a second setting.
const plain = /^[^\s"'`]*$/;
export const settingsSchema = z.object({
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
});

function quote(v: string) {
  // Never let a value span lines; single quotes can't be escaped in .env, so drop them.
  const clean = v.replace(/[\r\n]+/g, " ").replace(/'/g, "");
  return /[\s#"`]/.test(clean) ? `'${clean}'` : clean;
}

export async function updateConfig(patch: z.infer<typeof settingsSchema>) {
  const values: Record<string, string> = {};
  // A blank key field means "keep the current key", so it can't be erased by accident.
  if (patch.apiKey?.trim()) values.OPENAI_API_KEY = patch.apiKey.trim();
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

  const text = await readFile(ENV_PATH, "utf8").catch(() => "");
  const lines = text
    ? text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n")
    : [];
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${quote(value)}`;
    const at = lines.findIndex((l) => new RegExp(`^\\s*${key}\\s*=`).test(l));
    if (at >= 0) lines[at] = line;
    else lines.push(line);
    process.env[key] = value;
  }
  await writeFile(ENV_PATH, lines.join("\n") + "\n", "utf8");
  return publicConfig();
}

/** A minimal real request, to confirm the key, address and model all work. */
export async function testConnection(signal?: AbortSignal) {
  const start = performance.now();
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
    latencyMs: Math.round(performance.now() - start),
  };
}
