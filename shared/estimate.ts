// Estimates model usage for a set of analysis jobs before anything is sent.
// It builds the real requests and mirrors how server/llm.ts batches them.
import type { AnalysisRequest } from "./types";
import { SHARED_MESSAGE, buildRequest, compactQuestion } from "./request";
import { SYSTEM } from "./prompt";
import { requestLimits } from "./limits";

/** Rough tokenizer: Chinese characters cost more than JSON punctuation and ASCII. */
export function tokens(text: string) {
  let cjk = 0;
  for (const ch of text) if (ch.charCodeAt(0) > 0x2e80) cjk++;
  return Math.round(cjk * 0.62 + (text.length - cjk) * 0.3);
}

// The system prompt plus the fixed option tables: the same in every request.
const SYSTEM_TOKENS = tokens(SYSTEM) + tokens(SHARED_MESSAGE);
const CHUNK = 9; // server/llm.ts batch size
// Output per answer: a one-line reason plus probabilities.
const OUTPUT = { choice: 72, score: 60, noul: 38 } as const;
const CONTEXT_OUTPUT = 100; // the "context" summary each batch writes first

export type Estimate = {
  input: number;
  cached: number;
  output: number;
  requests: number;
};

// Jev returns bare probabilities, no reasons.
const JEV_OUTPUT = { choice: 12, score: 10, noul: 4 } as const;

export function estimateJobs(
  jobs: AnalysisRequest[],
  jev = requestLimits.provider === "jev",
): Estimate {
  const total: Estimate = { input: 0, cached: 0, output: 0, requests: 0 };
  if (jev) {
    // One request per job with the full questions; no system prompt, no cache.
    for (const job of jobs) {
      const { state, questions } = buildRequest(job);
      total.requests++;
      total.input += tokens(JSON.stringify({ state, questions }));
      total.output += Object.values(questions).reduce(
        (n, q) => n + JEV_OUTPUT[q.type],
        0,
      );
    }
    return total;
  }
  let systemCached = false;
  for (const job of jobs) {
    const { state, questions } = buildRequest(job);
    const stateTokens = tokens(JSON.stringify({ state }));
    const entries = Object.entries(questions);
    total.requests++;
    for (let i = 0; i < entries.length; i += CHUNK) {
      const chunk = entries.slice(i, i + CHUNK);
      const questionTokens = tokens(
        JSON.stringify({
          questions: Object.fromEntries(
            chunk.map(([k, q]) => [k, compactQuestion(q)]),
          ),
        }),
      );
      total.input += SYSTEM_TOKENS + stateTokens + questionTokens;
      // The system prompt and option tables are shared by every call; the chat state is cached
      // for the later batches of a job because the first one is sent alone.
      if (systemCached) total.cached += SYSTEM_TOKENS;
      if (i > 0) total.cached += stateTokens;
      systemCached = true;
      total.output +=
        CONTEXT_OUTPUT + chunk.reduce((n, [, q]) => n + OUTPUT[q.type], 0);
    }
  }
  return total;
}
