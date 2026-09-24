// Stand-ins for DeepSeek's chat-completions API and Jev's native API, so UI
// tests run offline and free.
// Answers are deterministic; usage numbers are large enough to exercise the cost cap.
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_PORT || 3191);

// The third message's intent is left unanswered the first time it is asked,
// so the UI shows it as incomplete and the retry path can be tested.
const failedOnce = new Set<string>();
function answer(questions: Record<string, any>) {
  const out: Record<string, unknown> = {};
  for (const [name, q] of Object.entries(questions)) {
    if (
      name.endsWith("_intents") &&
      String(q.instructions).includes("目标消息ID 2，") &&
      !failedOnce.has(name)
    ) {
      failedOnce.add(name);
      continue;
    }
    if (q.type === "noul") out[name] = { r: "测试理由", yes: 0.1 };
    else if (q.type === "score")
      out[name] = { r: "测试理由：接住了话题", p: { "2": 0.3, "3": 0.7 } };
    else {
      const labels = [...Object.keys(q.criteria ?? {}), ...(q.labels ?? [])];
      // Prefer a meaningful label over "none"/"unknown" for readable tags.
      const pick =
        labels.find((l) => !["none", "unknown", "insufficient"].includes(l)) ??
        labels[0];
      out[name] = {
        r: "测试理由：结合上下文判断",
        p: { [pick]: 0.8, [labels.at(-1)!]: 0.2 },
      };
    }
  }
  return { context: "测试：两人聊得轻松，对方愿意接话。", answers: out };
}

// ---- A stand-in for Jev's native API (the original project's contract) ----

/** What the Jev stand-in has seen, for the tests to check. */
const jevStats = {
  requests: 0,
  inFlight: 0,
  maxInFlight: 0,
  maxMessages: 0,
  maxChars: 0,
  rejected: [] as string[],
};
/** Chat messages in a request's state: objects with a sender and a text. */
function chatMessages(v: unknown, out: { text: string }[] = []) {
  if (Array.isArray(v)) v.forEach((x) => chatMessages(x, out));
  else if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.sender === "string" && typeof o.text === "string")
      out.push(o as { text: string });
    else Object.values(o).forEach((x) => chatMessages(x, out));
  }
  return out;
}
/** Answers every question the way Jev does: a full distribution summing to 1. */
function jevAnswers(questions: Record<string, any>) {
  const out: Record<string, unknown> = {};
  for (const [name, q] of Object.entries(questions)) {
    if (q.type === "noul") {
      out[name] = { type: "noul", noul: 0.1 };
      continue;
    }
    const labels =
      q.type === "score"
        ? q.criteria.map((_: unknown, i: number) => String(i))
        : Object.keys(q.criteria);
    const pick =
      q.type === "score"
        ? labels.at(-2)!
        : (labels.find(
            (l: string) => !["none", "unknown", "insufficient"].includes(l),
          ) ?? labels[0]);
    const rest = labels.filter((l: string) => l !== pick);
    const probabilities = Object.fromEntries(
      labels.map((l: string) => [
        l,
        l === pick ? (rest.length ? 0.8 : 1) : 0.2 / rest.length,
      ]),
    );
    out[name] =
      q.type === "score"
        ? {
            type: "score",
            score: Number(pick),
            confidence: 0.8,
            probabilities,
          }
        : { type: "choice", choice: pick, confidence: 0.8, probabilities };
  }
  return out;
}
/** Rejects request shapes the real Jev would not accept. */
function jevProblem(body: any) {
  if (body.model !== "typesafe/jev-1.13") return `model ${body.model}`;
  if (body.state === undefined) return "no state";
  if (body.messages) return "chat-completions body";
  for (const [name, q] of Object.entries<any>(body.questions ?? {})) {
    if (q.criteriaRef || q.labels) return `${name}: chat-model shorthand`;
    if (q.type !== "noul" && !q.criteria) return `${name}: no criteria`;
  }
  return "";
}

createServer((req, res) => {
  if (req.url === "/health") {
    res.end("ok");
    return;
  }
  if (req.url === "/jev-stats") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(jevStats));
    return;
  }
  if (req.url === "/jev") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      const body = JSON.parse(raw || "{}");
      jevStats.requests++;
      jevStats.inFlight++;
      jevStats.maxInFlight = Math.max(jevStats.maxInFlight, jevStats.inFlight);
      const chat = chatMessages(body.state);
      jevStats.maxMessages = Math.max(jevStats.maxMessages, chat.length);
      jevStats.maxChars = Math.max(
        jevStats.maxChars,
        chat.reduce((n, m) => n + Array.from(m.text).length, 0),
      );
      // Long enough for requests to overlap, so concurrency is observable.
      await new Promise((r) => setTimeout(r, 120));
      jevStats.inFlight--;
      const problem = jevProblem(body);
      res.setHeader("Content-Type", "application/json");
      if (problem) {
        jevStats.rejected.push(problem);
        res.statusCode = 400;
        res.end(JSON.stringify({ error: problem }));
        return;
      }
      res.end(
        JSON.stringify({
          model: body.model,
          answers: jevAnswers(body.questions),
          usage: { input_tokens: 3000, output_tokens: 60 },
        }),
      );
    });
    return;
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const payload = JSON.parse(body || "{}");
    const msgs: { content: string }[] = payload.messages ?? [];
    let content: unknown;
    // Analysis requests: system, shared option tables, state, questions.
    if (msgs.length === 4) {
      // Resolve shared option tables the way the real model is told to.
      const shared = JSON.parse(msgs[1].content).sharedCriteria;
      const questions = JSON.parse(msgs[3].content).questions;
      for (const q of Object.values<any>(questions))
        if (q.criteriaRef) q.criteria = shared[q.criteriaRef];
      content = answer(questions);
    } else if (msgs[0]?.content.includes("改进一条已经发出的回复"))
      content = {
        suggestions: [
          { text: "测试改写一", why: "更具体" },
          { text: "测试改写二", why: "更轻松" },
        ],
      };
    else content = { ok: true };
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        model: "mock-model",
        choices: [
          {
            message: { content: JSON.stringify(content) },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 20000,
          completion_tokens: 800,
          prompt_cache_hit_tokens: 10000,
        },
      }),
    );
  });
}).listen(PORT, "127.0.0.1");
