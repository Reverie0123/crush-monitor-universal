// A stand-in for DeepSeek's chat-completions API, so UI tests run offline and free.
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

createServer((req, res) => {
  if (req.url === "/health") {
    res.end("ok");
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
