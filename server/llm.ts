// Answers the analysis questions with either an OpenAI-compatible chat model
// (default) or TypeSafe's Jev, the original project's model. Both take the
// same request shape (state + typed questions) and give the same answer shape
// (choice / score / noul with probabilities), so the rules layer is unchanged.
import type { EntryType, Question, Questions } from "../shared/questions";
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { SYSTEM } from "../shared/prompt";
import { SHARED_MESSAGE, compactQuestion } from "../shared/request";
import { pickTemperature } from "./temperature";

// TypeSafe's Jev answers the same typed questions natively. It is sold
// directly and through two gateways; all three take the same request body.
export const JEV_PLATFORMS = {
  typesafe: {
    name: "TypeSafe",
    endpoint: "https://api.typesafe.ai/v1/systemone",
    model: "jev-1.13.0",
  },
  openrouter: {
    name: "OpenRouter",
    endpoint: "https://openrouter.ai/api/alpha/decisions",
    model: "typesafe/jev-1.13",
  },
  vercel: {
    name: "Vercel AI Gateway",
    endpoint: "https://ai-gateway.vercel.sh/typesafe/v1/systemone",
    model: "typesafe-ai/jev",
  },
} as const;
export type JevPlatform = keyof typeof JEV_PLATFORMS;
export const JEV_PLATFORM_KEYS = Object.keys(JEV_PLATFORMS) as [
  JevPlatform,
  ...JevPlatform[],
];

/** Read on every call so the settings page can change them without a restart. */
export function config() {
  const env = process.env;
  const temperature = Number.parseFloat(env.OPENAI_TEMPERATURE ?? "");
  const openaiKey = env.OPENAI_API_KEY?.trim() ?? "";
  const openaiModel = env.OPENAI_MODEL?.trim() || "deepseek-chat";
  const platform = (
    Object.hasOwn(JEV_PLATFORMS, env.JEV_PLATFORM?.trim() ?? "")
      ? env.JEV_PLATFORM!.trim()
      : "openrouter"
  ) as JevPlatform;
  const jev = {
    platform,
    ...JEV_PLATFORMS[platform],
    apiKey: env.JEV_API_KEY?.trim() ?? "",
  };
  const provider = env.LLM_PROVIDER?.trim() === "jev" ? "jev" : "openai";
  // With Jev, reply suggestions come from the chat model only if asked for.
  const jevSuggest = env.JEV_SUGGEST?.trim() === "on";
  return {
    provider,
    jevSuggest,
    /** Whether reply suggestions can be written with these settings. */
    suggest: !!openaiKey && (provider === "openai" || jevSuggest),
    /** Key and model of whichever service runs the analysis. */
    apiKey: provider === "jev" ? jev.apiKey : openaiKey,
    model: provider === "jev" ? jev.model : openaiModel,
    jev,
    /** The chat model: analysis in openai mode, reply suggestions in both. */
    openaiKey,
    openaiModel,
    baseURL: (
      env.OPENAI_BASE_URL?.trim() || "https://api.deepseek.com/v1"
    ).replace(/\/+$/, ""),
    effort: env.OPENAI_REASONING_EFFORT?.trim() ?? "",
    temperature: pickTemperature(
      temperature,
      env.OPENAI_REASONING_EFFORT?.trim() ?? "",
    ),
    mask: env.PRIVACY_MASK?.trim() !== "off",
    maskWords: (env.MASK_WORDS ?? "")
      .split(/[,，\n]/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2),
    cache: env.LLM_CACHE?.trim() !== "off",
  };
}

export class LLMError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type ChoiceAnswer = {
  type: "choice";
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
  reason?: string;
};
type ScoreAnswer = {
  type: "score";
  score: number;
  confidence: number;
  probabilities: Record<string, number>;
  reason?: string;
};
type NoulAnswer = { type: "noul"; noul: number; reason?: string };
export type Answer = ChoiceAnswer | ScoreAnswer | NoulAnswer;

// SYSTEM lives in shared/prompt.ts so cost estimates can measure it.

function distribution(raw: unknown, labels: string[]) {
  const p: Record<string, number> = {};
  if (raw && typeof raw === "object")
    for (const [k, v] of Object.entries(raw as Record<string, unknown>))
      if (labels.includes(k) && typeof v === "number" && v > 0) p[k] = v;
  const sum = Object.values(p).reduce((a, b) => a + b, 0);
  if (!sum) return null;
  for (const k of Object.keys(p)) p[k] = Math.min(1, p[k] / sum);
  return p;
}

export function toAnswer(q: Question, raw: unknown): Answer {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const reason =
    typeof body.r === "string" && body.r.trim()
      ? { reason: body.r.trim() }
      : {};
  if (q.type === "noul") {
    const yes = typeof body.yes === "number" ? body.yes : 0;
    return { type: "noul", noul: Math.min(1, Math.max(0, yes)), ...reason };
  }
  if (q.type === "score") {
    const labels = q.criteria.map((_, i) => String(i));
    const p = distribution(body.p, labels);
    // Missing answers degrade to zero confidence, which the rules treat as insufficient.
    if (!p)
      return {
        type: "score",
        score: (labels.length - 1) / 2,
        confidence: 0,
        probabilities: {},
      };
    const score = Object.entries(p).reduce((s, [k, v]) => s + Number(k) * v, 0);
    return {
      type: "score",
      score,
      confidence: Math.max(...Object.values(p)),
      probabilities: p,
      ...reason,
    };
  }
  const labels = Object.keys(q.criteria);
  const p = distribution(body.p, labels);
  if (!p)
    return {
      type: "choice",
      choice: labels[0],
      confidence: 0,
      probabilities: {},
    };
  const [choice, confidence] = Object.entries(p).sort((a, b) => b[1] - a[1])[0];
  return { type: "choice", choice, confidence, probabilities: p, ...reason };
}

// ---------- Privacy masking ----------

const PATTERNS: [string, RegExp][] = [
  ["邮箱", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g],
  ["身份证号", /(?<!\d)\d{17}[\dXx](?!\d)/g],
  ["银行卡号", /(?<!\d)\d{16,19}(?!\d)/g],
  ["手机号", /(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/g],
];

/**
 * Replaces personal details with stable placeholders before text leaves the
 * machine, and restores them in the model's explanations.
 */
export class Masker {
  private forward = new Map<string, string>();
  private counts = new Map<string, number>();
  constructor(
    private enabled: boolean,
    private words: string[] = [],
  ) {}
  private placeholder(kind: string, value: string) {
    let p = this.forward.get(value);
    if (!p) {
      const n = (this.counts.get(kind) ?? 0) + 1;
      this.counts.set(kind, n);
      p = `[${kind}${n}]`;
      this.forward.set(value, p);
    }
    return p;
  }
  /** Masks one piece of text. */
  text(value: string) {
    if (!this.enabled) return value;
    let out = value;
    for (const word of [...this.words].sort((a, b) => b.length - a.length))
      if (out.includes(word))
        out = out.split(word).join(this.placeholder("隐私词", word));
    for (const [kind, re] of PATTERNS)
      out = out.replace(re, (v) => this.placeholder(kind, v));
    return out;
  }
  /**
   * Masks every string value in a JSON-shaped object, never its keys: question
   * names carry message ids (UUIDs) that can contain phone-number-like digits,
   * and the answers are looked up by those exact names.
   */
  deep<T>(value: T): T {
    if (!this.enabled) return value;
    if (typeof value === "string") return this.text(value) as T;
    if (Array.isArray(value)) return value.map((v) => this.deep(v)) as T;
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, this.deep(v)]),
      ) as T;
    return value;
  }
  unmask(text: string) {
    let out = text;
    for (const [value, p] of this.forward) out = out.split(p).join(value);
    return out;
  }
  get count() {
    return this.forward.size;
  }
}

// ---------- Local response cache ----------

const CACHE_DIR = join(process.cwd(), ".cache", "llm");
// Cached replies contain chat text, so they expire and the folder stays bounded.
const CACHE_TTL_MS = 30 * 24 * 3600 * 1000;
const CACHE_MAX_BYTES = 200 * 1024 * 1024;
async function cacheGet(key: string) {
  const file = join(CACHE_DIR, `${key}.json`);
  try {
    if (Date.now() - (await stat(file)).mtimeMs > CACHE_TTL_MS)
      return undefined;
    return JSON.parse(await readFile(file, "utf8")) as ParsedReply;
  } catch {
    return undefined;
  }
}
/** Deletes expired entries, then the oldest ones while the folder is over its cap. */
export async function pruneCache() {
  let names: string[];
  try {
    names = await readdir(CACHE_DIR);
  } catch {
    return;
  }
  const files = (
    await Promise.all(
      names.map(async (name) => {
        const path = join(CACHE_DIR, name);
        try {
          const s = await stat(path);
          return { path, size: s.size, mtime: s.mtimeMs };
        } catch {
          return null;
        }
      }),
    )
  )
    .filter((f): f is NonNullable<typeof f> => !!f)
    .sort((a, b) => a.mtime - b.mtime);
  let total = files.reduce((n, f) => n + f.size, 0);
  for (const f of files) {
    if (Date.now() - f.mtime <= CACHE_TTL_MS && total <= CACHE_MAX_BYTES) break;
    try {
      await rm(f.path, { force: true });
    } catch {
      // Locked by a concurrent write (Windows EBUSY/EPERM): try again next hour.
    }
    total -= f.size;
  }
}
async function cachePut(key: string, value: ParsedReply) {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(join(CACHE_DIR, `${key}.json`), JSON.stringify(value));
  } catch {
    // A cache that cannot be written only costs money, never correctness.
  }
}
export async function clearCache() {
  await rm(CACHE_DIR, { recursive: true, force: true });
}

// ---------- Transport ----------

type Usage = {
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
};
const ZERO: Usage = { input_tokens: 0, output_tokens: 0, cached_tokens: 0 };
const add = (a: Usage, b: Usage): Usage => ({
  input_tokens: a.input_tokens + b.input_tokens,
  output_tokens: a.output_tokens + b.output_tokens,
  cached_tokens: a.cached_tokens + b.cached_tokens,
});

/** One chat completion in JSON mode. Retries are the caller's business. */
export async function callModel(
  messages: { role: "system" | "user"; content: string }[],
  signal?: AbortSignal,
  json = true,
) {
  const c = config();
  if (!c.openaiKey) throw new LLMError("OPENAI_API_KEY missing", 401);
  let response: Response;
  try {
    response = await fetch(`${c.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: c.openaiModel,
        ...(c.effort ? { reasoning_effort: c.effort } : {}),
        ...(c.temperature !== undefined ? { temperature: c.temperature } : {}),
        ...(json ? { response_format: { type: "json_object" } } : {}),
        messages,
      }),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new LLMError("network error", 502);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`Model API ${response.status}: ${detail.slice(0, 500)}`);
    throw new LLMError(
      `Model API ${response.status}: ${detail.slice(0, 200)}`,
      response.status,
    );
  }
  const data = (await response.json()) as {
    model?: string;
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_cache_hit_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
    };
  };
  const u = data.usage ?? {};
  return {
    model: data.model ?? c.openaiModel,
    content: data.choices?.[0]?.message?.content ?? "",
    finish: data.choices?.[0]?.finish_reason,
    usage: {
      input_tokens: u.prompt_tokens ?? 0,
      output_tokens: u.completion_tokens ?? 0,
      // DeepSeek and OpenAI report prefix-cache hits under different names.
      cached_tokens:
        u.prompt_cache_hit_tokens ??
        u.prompt_tokens_details?.cached_tokens ??
        0,
    },
  };
}

function tryParse(text: string) {
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object"
      ? (v as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}
/**
 * Parses a JSON reply, tolerating a markdown fence around it and the most
 * common chat-model slip: a complete object with a few closing braces too many
 * or too few. Anything else is left for a retry.
 */
export function parseJSON(
  content: string,
): Record<string, unknown> | undefined {
  const text = content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "").trim();
  const direct = tryParse(text);
  if (direct) return direct;
  let trimmed = text;
  for (let i = 0; i < 3 && trimmed.endsWith("}"); i++) {
    trimmed = trimmed.slice(0, -1).trimEnd();
    const v = tryParse(trimmed);
    if (v) return v;
  }
  for (let i = 1; i <= 3; i++) {
    const v = tryParse(text + "}".repeat(i));
    if (v) return v;
  }
  return undefined;
}

// ---------- systemOne ----------

type ParsedReply = {
  model: string;
  answers: Record<string, unknown>;
  context?: string;
};
type AskResult = ParsedReply & { usage: Usage };

export async function systemOne(
  request: { state: EntryType; questions: Questions },
  signal?: AbortSignal,
) {
  const c = config();
  const masker = new Masker(c.mask, c.maskWords);
  if (c.provider === "jev") return jevSystemOne(request, masker, signal);
  const entries = Object.entries(request.questions);
  // Small batches keep each reply short enough to never be truncated, and let
  // the model reason about every question instead of skimming a long list.
  const chunks: [string, Question][][] = [];
  for (let i = 0; i < entries.length; i += CHUNK)
    chunks.push(entries.slice(i, i + CHUNK));
  // The state message is identical across batches, so providers with prefix
  // caching (DeepSeek, OpenAI) bill the repeated chat history at cache rates.
  const stateMessage = JSON.stringify({ state: masker.deep(request.state) });
  // The provider only caches a prefix once a request using it has finished, so
  // parallel batches would all pay full price. Send one first, then the rest.
  const first = await robust(stateMessage, chunks[0], masker, signal);
  const results = [
    first,
    ...(await Promise.all(
      chunks
        .slice(1)
        .map((chunk) => robust(stateMessage, chunk, masker, signal)),
    )),
  ];
  const answers: Record<string, Answer> = {};
  for (const [i, chunk] of chunks.entries())
    for (const [name, q] of chunk) {
      const answer = toAnswer(q, results[i].answers[name]);
      if (answer.reason) answer.reason = masker.unmask(answer.reason);
      answers[name] = answer;
    }
  const context = results.find((r) => r.context)?.context;
  return {
    model: results[0]?.model ?? c.model,
    answers,
    // Every batch reads the same state; the first reading is as good as any.
    context: context && masker.unmask(context),
    usage: results.reduce((u, r) => add(u, r.usage), ZERO),
  };
}

// ---------- Jev ----------

const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

/**
 * Converts one native Jev answer. Jev's own choice, score and confidence are
 * kept; an answer of the wrong shape counts as unanswered, like a chat model's.
 */
export function jevAnswer(q: Question, raw: unknown): Answer {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  if (q.type === "noul") {
    const yes = body.type === "noul" ? num(body.noul) : undefined;
    return { type: "noul", noul: Math.min(1, Math.max(0, yes ?? 0)) };
  }
  const labels =
    q.type === "score"
      ? q.criteria.map((_, i) => String(i))
      : Object.keys(q.criteria);
  const p =
    body.type === q.type ? distribution(body.probabilities, labels) : null;
  if (!p) return toAnswer(q, undefined);
  const top = Math.max(...Object.values(p));
  const confidence = Math.min(1, Math.max(0, num(body.confidence) ?? top));
  if (q.type === "score") {
    const expected = Object.entries(p).reduce(
      (s, [k, v]) => s + Number(k) * v,
      0,
    );
    const given = num(body.score);
    return {
      type: "score",
      score:
        given !== undefined && given >= 0 && given <= labels.length - 1
          ? given
          : expected,
      confidence,
      probabilities: p,
    };
  }
  const given = typeof body.choice === "string" ? body.choice : "";
  return {
    type: "choice",
    choice: labels.includes(given)
      ? given
      : Object.entries(p).sort((a, b) => b[1] - a[1])[0][0],
    confidence,
    probabilities: p,
  };
}

/** One native Jev request, retried once on rate limits and server errors. */
export async function callJev(
  body: { state: EntryType; questions: Questions },
  signal?: AbortSignal,
) {
  const { jev } = config();
  if (!jev.apiKey) throw new LLMError("JEV_API_KEY missing", 401);
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(jev.endpoint, {
        method: "POST",
        redirect: "error",
        headers: {
          Authorization: `Bearer ${jev.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...body, model: jev.model }),
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new LLMError("network error", 502);
    }
    if (!response.ok) {
      // Provider bodies may echo the chat, so only the status is logged.
      await response.body?.cancel();
      console.error(`${jev.name} API ${response.status}`);
      if (attempt < 2 && (response.status === 429 || response.status >= 500)) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        signal?.throwIfAborted();
        continue;
      }
      throw new LLMError(`${jev.name} API ${response.status}`, response.status);
    }
    const data = (await response.json().catch(() => null)) as {
      model?: string;
      answers?: Record<string, unknown>;
      usage?: { input_tokens?: number; output_tokens?: number };
    } | null;
    if (!data?.answers || typeof data.answers !== "object")
      throw new LLMError(`${jev.name} returned no answers`, 422);
    return {
      model: data.model ?? jev.model,
      answers: data.answers,
      usage: {
        input_tokens: num(data.usage?.input_tokens) ?? 0,
        output_tokens: num(data.usage?.output_tokens) ?? 0,
        cached_tokens: 0,
      },
    };
  }
}

// Jev reads the full questions (not the chat-model shorthand) in one request
// and returns calibrated probabilities, but no written reasons.
async function jevSystemOne(
  request: { state: EntryType; questions: Questions },
  masker: Masker,
  signal?: AbortSignal,
) {
  const c = config();
  const body = {
    state: masker.deep(request.state),
    questions: masker.deep(request.questions),
  };
  const key = createHash("sha256")
    .update(JSON.stringify(["jev", c.jev.platform, c.jev.model, body]))
    .digest("hex");
  const hit = c.cache ? await cacheGet(key) : undefined;
  const reply = hit
    ? { ...hit, usage: ZERO }
    : await withSlot(() => callJev(body, signal));
  if (!hit && c.cache)
    await cachePut(key, { model: reply.model, answers: reply.answers });
  const answers: Record<string, Answer> = {};
  for (const [name, q] of Object.entries(request.questions))
    answers[name] = jevAnswer(q, reply.answers[name]);
  return {
    model: reply.model,
    answers,
    context: undefined as string | undefined,
    usage: reply.usage,
  };
}

// Malformed output is usually specific to one generation: split the batch and
// ask again, and as a last resort leave a single question unanswered, which the
// rules layer reports as insufficient instead of failing the whole job.
async function robust(
  stateMessage: string,
  chunk: [string, Question][],
  masker: Masker,
  signal?: AbortSignal,
): Promise<AskResult> {
  try {
    return await withSlot(() => ask(stateMessage, chunk, masker, signal));
  } catch (error) {
    if (!(error instanceof LLMError) || error.status !== 422 || signal?.aborted)
      throw error;
    if (chunk.length === 1) {
      console.error(
        `Question ${chunk[0][0]} left unanswered after repeated malformed output`,
      );
      return { model: config().openaiModel, answers: {}, usage: ZERO };
    }
    const half = Math.ceil(chunk.length / 2);
    const parts = await Promise.all([
      robust(stateMessage, chunk.slice(0, half), masker, signal),
      robust(stateMessage, chunk.slice(half), masker, signal),
    ]);
    return {
      model: parts[0].model,
      answers: { ...parts[0].answers, ...parts[1].answers },
      context: parts[0].context ?? parts[1].context,
      usage: add(parts[0].usage, parts[1].usage),
    };
  }
}

const CHUNK = 9;
// Upstream calls in flight at once.
const MAX_PARALLEL = Number(process.env.LLM_PARALLEL) || 24;
let running = 0;
const waiting: (() => void)[] = [];
async function withSlot<T>(fn: () => Promise<T>) {
  if (running >= MAX_PARALLEL) await new Promise<void>((r) => waiting.push(r));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

async function ask(
  stateMessage: string,
  chunk: [string, Question][],
  masker: Masker,
  signal?: AbortSignal,
  attempt = 0,
): Promise<AskResult> {
  const c = config();
  // Keys stay as-is: answers are matched back to them exactly.
  const questions = JSON.stringify({
    questions: Object.fromEntries(
      chunk.map(([k, q]) => [k, masker.deep(compactQuestion(q))]),
    ),
  });
  const messages = [
    { role: "system" as const, content: SYSTEM },
    // Identical in every request, so the provider serves it from cache.
    { role: "user" as const, content: SHARED_MESSAGE },
    { role: "user" as const, content: stateMessage },
    { role: "user" as const, content: questions },
  ];
  const key = createHash("sha256")
    .update(
      JSON.stringify([
        c.openaiModel,
        c.baseURL,
        c.effort,
        c.temperature,
        messages,
      ]),
    )
    .digest("hex");
  if (c.cache) {
    const hit = await cacheGet(key);
    if (hit) return { ...hit, usage: ZERO };
  }
  const retry = (error: LLMError) => {
    if (attempt >= 2 || signal?.aborted) throw error;
    return ask(stateMessage, chunk, masker, signal, attempt + 1);
  };
  let reply: Awaited<ReturnType<typeof callModel>>;
  try {
    reply = await callModel(messages, signal);
  } catch (error) {
    if (
      error instanceof LLMError &&
      (error.status === 429 || error.status >= 500)
    )
      return retry(error);
    throw error;
  }
  const parsed = parseJSON(reply.content);
  if (!parsed) {
    console.error(
      `Model JSON parse failed: finish_reason=${reply.finish} length=${reply.content.length} tail=${JSON.stringify(reply.content.slice(-200))}`,
    );
    return retry(new LLMError("model returned invalid JSON", 422));
  }
  const result: ParsedReply = {
    model: reply.model,
    answers: (parsed.answers as Record<string, unknown>) ?? {},
    context: typeof parsed.context === "string" ? parsed.context : undefined,
  };
  if (c.cache) await cachePut(key, result);
  return { ...result, usage: reply.usage };
}
