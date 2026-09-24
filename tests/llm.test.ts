import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { choice, noul, score } from "../shared/questions";
import {
  Masker,
  jevAnswer,
  parseJSON,
  systemOne,
  toAnswer,
} from "../server/llm";
import { settingsSchema, testConnection } from "../server/settings";
import { findQuoted, periods, splitQuote, timings } from "../shared/context";
import { buildRequest } from "../server/analysis";
import type { Message } from "../shared/types";
import { parseChat, toMessages, withKind } from "../shared/parser";
import { INTENTS } from "../shared/intents";
import { estimateJobs } from "../shared/estimate";
import { overviewJob } from "../shared/incremental";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
function env() {
  process.env.LLM_PROVIDER = "openai";
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_BASE_URL = "http://model.test/v1";
  process.env.LLM_CACHE = "off";
  process.env.PRIVACY_MASK = "on";
  process.env.MASK_WORDS = "";
}
/** Replaces fetch with a fake chat-completions endpoint. */
function fakeModel(
  reply: (questions: Record<string, { type: string }>, body: any) => string,
) {
  const calls: any[] = [];
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init!.body));
    calls.push(body);
    const { questions } = JSON.parse(body.messages.at(-1).content);
    return new Response(
      JSON.stringify({
        model: "fake",
        choices: [{ message: { content: reply(questions, body) } }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 10,
          prompt_cache_hit_tokens: 60,
        },
      }),
    );
  }) as typeof fetch;
  return calls;
}
const msg = (
  sender: "self" | "other",
  text: string,
  timestamp: string | null = null,
  i = 0,
): Message => ({
  id: `m${i}`,
  sender,
  text,
  timestamp,
  kind: "text",
});

test("选项答案过滤编造的键并归一化，理由被保留", () => {
  const q = choice("情绪？", { happy: "开心", sad: "难过" });
  const a = toAnswer(q, {
    r: "前面在开玩笑",
    p: { happy: 3, sad: 1, bogus: 5 },
  });
  assert.equal(a.type, "choice");
  if (a.type !== "choice") return;
  assert.equal(a.choice, "happy");
  assert.equal(a.confidence, 0.75);
  assert.deepEqual(Object.keys(a.probabilities).sort(), ["happy", "sad"]);
  assert.equal(a.reason, "前面在开玩笑");
});

test("评分取期望值，缺失答案降为零确定度", () => {
  const q = score("评分", ["低", "中", "高"]);
  const a = toAnswer(q, { p: { "1": 0.5, "2": 0.5 } });
  assert.ok(a.type === "score" && a.score === 1.5 && a.confidence === 0.5);
  const missing = toAnswer(q, undefined);
  assert.ok(missing.type === "score" && missing.confidence === 0);
  const yes = toAnswer(noul("是否？"), { yes: 1.7 });
  assert.ok(yes.type === "noul" && yes.noul === 1);
});

test("解析兼容 markdown 代码块，坏 JSON 返回 undefined", () => {
  assert.deepEqual(parseJSON('```json\n{"a":1}\n```'), { a: 1 });
  assert.equal(parseJSON('{"r": "对方回了"哦""}'), undefined);
  // Complete objects with a brace too many or too few are repaired instead of retried.
  assert.deepEqual(parseJSON('{"answers": {"a": {"yes": 1}}}}'), {
    answers: { a: { yes: 1 } },
  });
  assert.deepEqual(parseJSON('{"answers": {"a": {"yes": 1}}'), {
    answers: { a: { yes: 1 } },
  });
});

test("打码替换手机号、邮箱和自定义词，并能在理由里还原", () => {
  const m = new Masker(true, ["张三"]);
  const masked = JSON.stringify(
    m.deep({
      t: "张三的电话13812345678，邮箱 a.b@qq.com，再打13812345678",
    }),
  );
  assert.ok(
    !masked.includes("13812345678") &&
      !masked.includes("张三") &&
      !masked.includes("qq.com"),
  );
  assert.equal(masked.match(/\[手机号1\]/g)?.length, 2);
  assert.equal(m.unmask("[隐私词1]给了[手机号1]"), "张三给了13812345678");
  assert.equal(new Masker(false).text("13812345678"), "13812345678");
});

test("打码只动文字内容，不动问题名（问题名里的消息编号可能像手机号）", () => {
  const m = new Masker(true, ["abc"]);
  // A UUID fragment with 11 digits starting 13: looks like a phone number.
  const key = "5f0c2d1e-9a8b-4c3d-a13812345678_emotions";
  const out = m.deep({ [key]: { instructions: "打给13812345678，abc" } });
  assert.deepEqual(Object.keys(out), [key]);
  assert.equal(out[key].instructions, "打给[手机号1]，[隐私词1]");
});

test("引用回复拆出原话并找到被引用的消息", () => {
  const ms = [
    msg("self", "周末那家店最好提前订位哦", null, 0),
    msg(
      "other",
      "要排很久吗？好的呀\n引用：阿杰 : 周末那家店最好提前订位哦",
      null,
      1,
    ),
  ];
  assert.deepEqual(splitQuote(ms[1].text), {
    text: "要排很久吗？好的呀",
    quote: "周末那家店最好提前订位哦",
  });
  assert.equal(findQuoted(ms, 1, "周末那家店最好提前订位哦"), 0);
  const req = buildRequest({
    messages: ms,
    relation: "crush",
    revision: 1,
    task: "overview",
    targetIds: [],
  });
  const second = (req.state.messages as any[])[1];
  assert.equal(second.text, "要排很久吗？好的呀");
  assert.equal(second.replyTo, "0");
});

test("撤回和拍一拍按正文判断是谁做的，变成系统提示", () => {
  // The exporter files both recalls under the other person's header.
  const raw = [
    "小雨 2026-08-12 00:35:21",
    '"小雨" 撤回了一条消息',
    "",
    "小雨 2026-08-12 00:51:44",
    "你撤回了一条消息",
    "",
    "我 2026-08-19 15:33:02",
    "你撤回了一条消息0",
    "",
    "我 2026-08-19 15:34:00",
    "你怎么撤回了一条消息",
    "",
    "小雨 2026-08-19 15:35:00",
    '"小雨" 拍了拍我',
    "",
  ].join("\n");
  const ms = toMessages(parseChat(raw).messages, "我");
  assert.deepEqual(
    ms.map((m) => [m.sender, m.kind, m.text]),
    [
      ["other", "system", "对方撤回了一条消息"],
      ["self", "system", "你撤回了一条消息"],
      ["self", "system", "你撤回了一条消息"],
      ["self", "text", "你怎么撤回了一条消息"],
      ["other", "system", '"小雨" 拍了拍我'],
    ],
  );
  // Chats saved before this rule existed are reclassified on load.
  const old = {
    ...ms[1],
    sender: "other" as const,
    kind: "text" as const,
    text: "你撤回了一条消息",
  };
  assert.deepEqual(
    [withKind(old).sender, withKind(old).kind],
    ["self", "system"],
  );
  // System notices are sent as context but never analysed on their own.
  const req = buildRequest({
    messages: ms,
    relation: "crush",
    revision: 1,
    task: "other_messages",
    targetIds: [ms[0].id],
  });
  assert.equal((req.state.messages as any[])[0].kind, "system");
  assert.deepEqual(Object.keys(req.questions), []);
  assert.ok("academic" in INTENTS);
});

test("导出工具的摘要头被跳过，不会被当成发言人", () => {
  const raw = [
    "【聊天记录摘要】",
    "会话名称：小雨",
    "导出时间：2026-08-28 16:30:18",
    "导出软件：某导出工具",
    "",
    "我 2026-07-31 22:32:11",
    "我靠太凶残了",
    "",
    "小雨 2026-07-31 22:35:27",
    "我去",
  ].join("\n");
  const p = parseChat(raw);
  assert.deepEqual(
    p.messages.map((m) => m.speaker),
    ["我", "小雨"],
  );
  assert.deepEqual(p.warnings, []);
});

test("正文里「词 + 时间」的一行不会被当成新消息丢掉", () => {
  const raw = ["张三 12:30", "好的", "明天 10:30", "李四 12:31", "行"].join(
    "\n",
  );
  const p = parseChat(raw);
  assert.deepEqual(
    p.messages.map((m) => [m.speaker, m.text]),
    [
      ["张三", "好的\n明天 10:30"],
      ["李四", "行"],
    ],
  );
});

test("摘要头后面没有空行时，也不会吞掉聊天内容", () => {
  const raw = [
    "【聊天记录摘要】",
    "会话名称：小雨",
    "导出时间：2026-08-28 16:30:18",
    "我 2026-07-31 22:32:11",
    "第一句",
    "",
    "小雨 2026-07-31 22:35:27",
    "第二句",
  ].join("\n");
  assert.deepEqual(
    parseChat(raw).messages.map((m) => m.text),
    ["第一句", "第二句"],
  );
});

test("时间戳换算成时段和回复间隔，没有时间戳时不加", () => {
  const t = timings([
    msg("other", "在吗", "2026-08-28 23:50:00"),
    msg("self", "在", "2026-08-28 23:50:20"),
    msg("self", "怎么了", "2026-08-29 01:10:00"),
    msg("other", "没事", null),
  ]);
  assert.equal(t[0].when, "周五深夜");
  assert.equal(t[1].replyTo, "1分钟内");
  assert.equal(t[2].gap, "1.3小时");
  assert.equal(t[2].when, "周六深夜");
  assert.deepEqual(t[3], {});
});

test("按周分段，稀疏的周并入前一周", () => {
  const ms: Message[] = [];
  for (let d = 0; d < 21; d++)
    for (let k = 0; k < (d >= 14 ? 1 : 10); k++)
      ms.push(
        msg(
          k % 2 ? "self" : "other",
          "嗯",
          `2026-08-${String(3 + d).padStart(2, "0")} 12:00:00`,
          ms.length,
        ),
      );
  const p = periods(ms);
  assert.equal(p.length, 2);
  assert.equal(p.at(-1)!.end, ms.length - 1);
});

test("批量坏 JSON 会拆开重问，单题反复失败只让这一题信息不足", async () => {
  env();
  const calls = fakeModel((qs) => {
    const names = Object.keys(qs);
    if (names.length > 2 || names.includes("q3"))
      return '{"answers": {"r": "坏了';
    return JSON.stringify({
      context: "整体轻松",
      answers: Object.fromEntries(
        names.map((n) => [n, { r: `理由${n}`, yes: 0.9 }]),
      ),
    });
  });
  const questions = Object.fromEntries(
    ["q1", "q2", "q3", "q4"].map((n) => [n, noul(n)]),
  );
  const out = await systemOne({ state: { messages: [] }, questions });
  assert.equal((out.answers.q1 as any).noul, 0.9);
  assert.equal((out.answers.q1 as any).reason, "理由q1");
  assert.equal((out.answers.q3 as any).noul, 0);
  assert.equal(out.context, "整体轻松");
  assert.ok(calls.length >= 4);
  // DeepSeek's cache-hit field is carried through for every successful call.
  assert.equal(out.usage.cached_tokens * 100, out.usage.input_tokens * 60);
});

test("设置里的值不能换行或带引号，写不进额外的 .env 行", () => {
  const bad = [
    { apiKey: "sk-x'\nOPENAI_BASE_URL=https://evil" },
    { model: "m\nLLM_CACHE=off" },
    { baseURL: "https://api.deepseek.com/v1\nPRIVACY_MASK=off" },
  ];
  for (const b of bad) assert.equal(settingsSchema.safeParse(b).success, false);
  assert.equal(
    settingsSchema.safeParse({ apiKey: " sk-abc123 ", model: "deepseek-chat" })
      .success,
    true,
  );
});

test("花费估算与实测的 1950 条整体分析相差不到 10%", () => {
  const pool = [
    "今天加班到九点，累死了",
    "辛苦了！吃饭了没",
    "还没，回家随便煮个面",
    "别凑合啊，楼下那家牛肉面不是挺好吃的",
    "哈哈你还记得那家",
    "下次一起去呗",
  ];
  const big: Message[] = Array.from({ length: 2000 }, (_, i) =>
    msg(i % 2 ? "self" : "other", pool[i % pool.length], null, i),
  );
  const e = estimateJobs([overviewJob(big, "crush", 1, {})]);
  // Measured against DeepSeek: 110,540 input tokens over 3 batches.
  assert.ok(Math.abs(e.input - 110540) / 110540 < 0.1, `input ${e.input}`);
  assert.ok(e.cached > 0 && e.cached < e.input);
  assert.equal(e.requests, 1);
});

test("打码后的内容才会发出，理由里的占位符被还原", async () => {
  env();
  const calls = fakeModel((qs) =>
    JSON.stringify({
      answers: Object.fromEntries(
        Object.keys(qs).map((n) => [n, { r: "提到了[手机号1]", yes: 0.2 }]),
      ),
    }),
  );
  const out = await systemOne({
    state: { text: "我的号码是13912345678" },
    questions: { a: noul("?") },
  });
  assert.ok(!JSON.stringify(calls).includes("13912345678"));
  assert.equal((out.answers.a as any).reason, "提到了13912345678");
});

test("Jev 原生答案保留自带的选项、分数和确定度，格式不对的当作未回答", () => {
  const c = choice("情绪", { 开心: null, 难过: null });
  assert.deepEqual(
    jevAnswer(c, {
      type: "choice",
      choice: "难过",
      confidence: 0.7,
      probabilities: { 开心: 0.3, 难过: 0.7, 编造: 0.5 },
    }),
    {
      type: "choice",
      choice: "难过",
      confidence: 0.7,
      probabilities: { 开心: 0.3, 难过: 0.7 },
    },
  );
  const s = score("好感", ["低", "中", "高"]);
  const a = jevAnswer(s, {
    type: "score",
    score: 1.4,
    confidence: 0.6,
    probabilities: { "0": 0.1, "1": 0.4, "2": 0.5 },
  });
  assert.equal(a.type === "score" && a.score, 1.4);
  assert.equal(
    jevAnswer(s, { type: "choice", probabilities: {} }).type,
    "score",
  );
  assert.equal(
    (jevAnswer(s, { type: "choice" }) as { confidence: number }).confidence,
    0,
  );
  assert.deepEqual(jevAnswer(noul("拒绝"), { type: "noul", noul: 0.2 }), {
    type: "noul",
    noul: 0.2,
  });
});

test("选 Jev 时发完整问题到所选平台，一次请求，打码照常", async () => {
  env();
  process.env.LLM_PROVIDER = "jev";
  process.env.JEV_PLATFORM = "openrouter";
  process.env.JEV_API_KEY = "jev-key";
  try {
    const calls: { url: string; auth: string; body: any }[] = [];
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init!.body));
      calls.push({
        url,
        auth: new Headers(init!.headers).get("Authorization") ?? "",
        body,
      });
      return new Response(
        JSON.stringify({
          model: "typesafe/jev-1.13",
          answers: {
            mood: {
              type: "choice",
              choice: "开心",
              confidence: 0.8,
              probabilities: { 开心: 0.8, 难过: 0.2 },
            },
            refuse: { type: "noul", noul: 0.1 },
          },
          usage: { input_tokens: 500, output_tokens: 20 },
        }),
      );
    }) as typeof fetch;
    const result = await systemOne({
      state: { chat: "我的电话 13812345678" },
      questions: {
        mood: choice("情绪", { 开心: "心情好", 难过: null }),
        refuse: noul("拒绝了吗"),
      },
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://openrouter.ai/api/alpha/decisions");
    assert.equal(calls[0].auth, "Bearer jev-key");
    assert.equal(calls[0].body.model, "typesafe/jev-1.13");
    // Full criteria, not the chat-model shorthand.
    assert.equal(calls[0].body.questions.mood.criteria.开心, "心情好");
    assert.ok(!JSON.stringify(calls[0].body).includes("13812345678"));
    assert.equal(
      result.answers.mood.type === "choice" && result.answers.mood.choice,
      "开心",
    );
    assert.equal(result.usage.input_tokens, 500);
  } finally {
    process.env.LLM_PROVIDER = "openai";
    delete process.env.JEV_API_KEY;
  }
});

test("Jev + 其他模型时，测试连接两边都测；回复建议的 Key 坏了会说清楚", async () => {
  env();
  process.env.LLM_PROVIDER = "jev";
  process.env.JEV_API_KEY = "jev-key";
  process.env.JEV_SUGGEST = "on";
  let chatOk = true;
  globalThis.fetch = (async (url: string) => {
    if (String(url).includes("/chat/completions"))
      return chatOk
        ? new Response(
            JSON.stringify({
              model: "fake-chat",
              choices: [{ message: { content: '{"ok": true}' } }],
            }),
          )
        : new Response("bad key", { status: 401 });
    return new Response(
      JSON.stringify({
        model: "jev",
        answers: {
          color: {
            type: "choice",
            choice: "blue",
            confidence: 0.9,
            probabilities: { blue: 0.9, red: 0.1 },
          },
        },
      }),
    );
  }) as typeof fetch;
  try {
    const good = await testConnection();
    assert.equal(good.ok, true);
    assert.match(String(good.model), /fake-chat/);
    chatOk = false;
    const bad = await testConnection();
    assert.equal(bad.ok, false);
    assert.match(String((bad as { error?: string }).error), /回复建议/);
    process.env.JEV_SUGGEST = "off";
    assert.equal((await testConnection()).ok, true);
  } finally {
    process.env.LLM_PROVIDER = "openai";
    delete process.env.JEV_API_KEY;
    delete process.env.JEV_SUGGEST;
  }
});
