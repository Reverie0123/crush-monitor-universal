import { test } from "node:test";
import assert from "node:assert/strict";
import { planRun, plannedRequests, type RunState } from "../shared/plan";
import {
  GUARD,
  SHARED_CRITERIA,
  buildRequest,
  compactQuestion,
} from "../shared/request";
import type { Message } from "../shared/types";
import { learnEstimateFactor } from "../src/cost";
import {
  CHAT_LIMITS,
  JEV_LIMITS,
  overLimit,
  setRequestLimits,
} from "../shared/limits";

const day = (d: number) => `2026-08-${String(d).padStart(2, "0")} 20:00:00`;
// Ten days of chat, four messages a day, alternating speakers.
const chat: Message[] = Array.from({ length: 40 }, (_, i) => ({
  id: `m${i}`,
  sender: i % 2 ? "self" : "other",
  text: `第${i}句`,
  timestamp: day(1 + Math.floor(i / 4)),
  kind: "text",
}));
const empty: RunState = {
  prior: null,
  processed: 0,
  stale: false,
  lines: {},
  events: {},
  periods: [],
  corrections: {},
};
const targets = (p: ReturnType<typeof planRun>) =>
  p.jobs.flatMap((j) =>
    j.targetIds.map((id) => chat.find((m) => m.id === id)!),
  );

test("快速档不逐句分析，只发整体分析", () => {
  const p = planRun(chat, "crush", "", { level: "quick", days: null }, empty);
  assert.equal(p.jobs.length, 0);
  assert.equal(p.needed, true);
  const requests = plannedRequests(chat, "crush", "", p);
  assert.ok(requests.every((r) => r.task === "overview"));
  assert.equal(
    requests.filter((r) => r.targetIds.length === 0).length,
    requests.length,
  );
});

test("标准档只分析对方的消息，完整档两边都分析", () => {
  const standard = targets(
    planRun(chat, "crush", "", { level: "standard", days: null }, empty),
  );
  assert.ok(standard.length > 0 && standard.every((m) => m.sender === "other"));
  const full = targets(
    planRun(chat, "crush", "", { level: "full", days: null }, empty),
  );
  assert.deepEqual(
    new Set(full.map((m) => m.sender)),
    new Set(["self", "other"]),
  );
});

test("只分析最近 N 天的消息", () => {
  const p = planRun(chat, "crush", "", { level: "full", days: 3 }, empty);
  // The chat ends on 8/10, so lines from 8/07 onward are in range.
  assert.ok(targets(p).every((m) => m.timestamp! >= day(7)));
  assert.ok(targets(p).length > 0);
});

test("旧版规则的结果会全部重做，不会当成已完成", () => {
  const done: RunState = {
    ...empty,
    prior: { messages: chat, relation: "crush", note: "" },
    processed: chat.length,
    lines: Object.fromEntries(
      chat.map((m) => [
        m.id,
        {
          id: m.id,
          score: {
            value: 60,
            confidence: 1,
            status: "clear" as const,
            probabilities: {},
          },
        },
      ]),
    ),
  };
  const scope = { level: "full" as const, days: null };
  assert.equal(planRun(chat, "crush", "", scope, done).needed, false);
  const stale = planRun(chat, "crush", "", scope, { ...done, stale: true });
  assert.equal(stale.append, false);
  assert.equal(stale.lineCount, 40);
});

test("估算系数从实际用量学习，异常值（如缓存命中）被忽略", () => {
  // Real run cost 80% of the estimate: the factor moves halfway there.
  assert.equal(learnEstimateFactor(1, 10, 8), 0.9);
  // Almost free (answers came from the local cache): ignored.
  assert.equal(learnEstimateFactor(1, 10, 0.5), 1);
  // Tiny runs say nothing reliable.
  assert.equal(learnEstimateFactor(1, 0.01, 0.02), 1);
  // Never drifts beyond 0.5–2 however far off one run is.
  assert.equal(learnEstimateFactor(0.55, 10, 3.1), 0.5);
});

test("共享选项表：重复的选项定义只发一次，每道题都还能找到自己的选项", () => {
  const p = planRun(chat, "crush", "", { level: "full", days: null }, empty);
  let refs = 0;
  for (const job of plannedRequests(chat, "crush", "", p)) {
    for (const q of Object.values(buildRequest(job).questions)) {
      const c = compactQuestion(q) as Record<string, unknown>;
      // The shared reminder moved into the system prompt.
      assert.ok(!JSON.stringify(c).includes(GUARD));
      if (q.type === "noul") continue;
      if (c.criteriaRef) {
        refs++;
        // The table named must be exactly the options the answer is checked against.
        assert.deepEqual(SHARED_CRITERIA[c.criteriaRef as string], q.criteria);
      } else assert.ok(c.criteria || c.labels);
    }
  }
  assert.ok(refs > 0);
});

test("用户对某条消息的纠正会随请求发给模型", () => {
  const p = planRun(
    chat,
    "crush",
    "高中同学",
    { level: "full", days: null },
    {
      ...empty,
      corrections: { m4: "这句是开玩笑" },
    },
  );
  const job = p.jobs.find((j) => j.targetIds.includes("m4"))!;
  assert.deepEqual(job.feedback, [{ id: "m4", text: "这句是开玩笑" }]);
  assert.equal(job.note, "高中同学");
  const state = buildRequest(job).state as { userCorrections?: unknown[] };
  assert.equal(state.userCorrections?.length, 1);
});

test("选 Jev 时长聊天分批：每次请求不超过 500 条 / 12,000 字，逐句覆盖全部", () => {
  // 1,200 messages of 20 characters: 24,000 characters in all.
  const long: Message[] = Array.from({ length: 1200 }, (_, i) => ({
    id: `L${i}`,
    sender: i % 2 ? "self" : "other",
    text: `第${String(i).padStart(4, "0")}句聊天内容，凑够二十个字啊`,
    timestamp: day(1 + Math.floor(i / 50)),
    kind: "text",
  }));
  setRequestLimits(JEV_LIMITS);
  try {
    assert.ok(overLimit(long.map((m) => m.text)));
    const p = planRun(long, "crush", "", { level: "full", days: null }, empty);
    const requests = plannedRequests(long, "crush", "", p);
    for (const r of requests) {
      assert.ok(r.messages.length <= 500, `${r.messages.length} 条`);
      const chars = r.messages.reduce(
        (n, m) => n + Array.from(m.text).length,
        0,
      );
      assert.ok(chars <= 12000, `${chars} 字`);
      assert.ok(r.targetIds.length <= 10);
    }
    // Every message is still analyzed, just in more requests.
    assert.equal(p.lineCount, 1200);
    // The overview reads the most recent part.
    assert.equal(requests[0].messages.at(-1)!.id, "L1199");
  } finally {
    setRequestLimits(CHAT_LIMITS);
  }
  assert.ok(!overLimit(long.map((m) => m.text)));
});
