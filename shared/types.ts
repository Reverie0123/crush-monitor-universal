import type { MemoryEvent, MemoryUpdate } from "./memory";
import type { AffinityDimension } from "./affinity";
export type Relation =
  | "new"
  | "friend"
  | "secret"
  | "crush"
  | "pursuing"
  | "pursued"
  | "couple"
  | "cold"
  | "ex"
  | "reconcile";
export type Message = {
  id: string;
  sender: "self" | "other";
  text: string;
  timestamp: string | null;
  /** unreadable: [图片]-style placeholders; system: notices like recalls. Both are context only. */
  kind: "text" | "unreadable" | "system";
};
export type Parsed = {
  speaker: string;
  text: string;
  timestamp: string | null;
};
export type Judgment = {
  value: number | null;
  confidence: number;
  status: "clear" | "ambiguous" | "insufficient";
  probabilities: Record<string, number>;
  /** The model's one-line, context-grounded rationale. */
  reason?: string;
};
export type LineResult = {
  reasons?: { emotion?: string; intent?: string };
  /** The user's explanation this line was re-judged with. */
  correction?: string;
  /** Some answers were missing after retries; the line can be retried alone. */
  incomplete?: boolean;
  suggestions?: Suggestion[];
  event?: { kind: MemoryEvent["kind"]; confidence: number };
  skipped?: string;
  id: string;
  score: Judgment;
  emotions?: Record<string, number>;
  intents?: Record<string, number>;
};
export type Overview = {
  memoryEvidenceIds?: string[];
  contextCount?: number;
  affinity: Judgment;
  affinityDimensions?: AffinityDimension[];
  affinityRawValue?: number;
  boundaryApplied?: boolean;
  stage: string;
  rapport?: Judgment;
  action: string;
  alternative?: string;
  evidenceId: string | null;
  actionEvidenceId: string | null;
  /** The model's overall reading of the conversation. */
  reading?: string;
  actionReason?: string;
};
export type Suggestion = { text: string; why: string };
export type Usage = {
  input_tokens: number;
  output_tokens: number;
  /** Input tokens billed at the provider's prefix-cache rate. */
  cached_tokens?: number;
};
/** Affinity for one time period, used for the trend chart. */
export type Period = {
  label: string;
  startId: string;
  endId: string;
  count: number;
  value: number | null;
  reading?: string;
  evidenceId: string | null;
};
export type Task = "overview" | "other_messages" | "self_message";
export type AnalysisRequest = {
  memory?: Pick<MemoryEvent, "id" | "kind" | "status" | "resolvedBy">[];
  revision: number;
  relation: Relation;
  /** Free-form background the user wrote about the relationship. */
  note?: string;
  /** The user's own explanations for specific target messages. */
  feedback?: { id: string; text: string }[];
  messages: Message[];
  task: Task;
  targetIds: string[];
};
export type AnalysisResponse = {
  memoryUpdates?: MemoryUpdate[];
  revision: number;
  contextHash: string;
  model: string;
  rubricVersion: string;
  overview?: Overview;
  lines?: LineResult[];
  usage: Usage;
  latencyMs: number;
};
export const MODEL = "openai-chat";
// Bumped whenever the request shape changes, so a stale server can say so.
export const API_VERSION = "2026-09-25.1";
// Bumped when prompts or answer shapes change, so saved results are re-analyzed.
export const RUBRIC = "crush-2026-09-24.llm-5";
type RelationInfo = {
  label: string;
  group: string;
  /** What the model should keep in mind when reading this kind of chat. */
  context: string;
  /** Already together: rate rapport instead of romantic milestones. */
  established?: boolean;
};
// Keys are stored in saved chats; add new ones, never rename old ones.
export const RELATION_INFO: Record<Relation, RelationInfo> = {
  new: {
    label: "刚认识",
    group: "认识阶段",
    context: "刚认识不久，还在互相了解；礼貌、客气和试探都正常，不要过度解读",
  },
  friend: {
    label: "普通朋友",
    group: "认识阶段",
    context: "目前是普通朋友；友好、关心和玩笑不自动等于暧昧",
  },
  secret: {
    label: "我单方面有好感",
    group: "心动",
    context:
      "你（self）对对方有好感，但对方未必知道、态度未知；重点看对方的回应和投入，不要把礼貌当心动",
  },
  crush: {
    label: "暧昧中",
    group: "心动",
    context: "两人处在暧昧阶段，互相有些好感但还没挑明",
  },
  pursuing: {
    label: "我在追对方",
    group: "心动",
    context:
      "你（self）在明确追求对方；重点看对方是接受、回应还是回避，以及你的追求是否让对方舒服、有没有施压",
  },
  pursued: {
    label: "对方在追我",
    group: "心动",
    context:
      "对方在明确追求你（self）；对方的主动是常态，重点看对方的用心程度，以及你的回应是否清晰、让自己舒服",
  },
  couple: {
    label: "恋爱中",
    group: "恋爱",
    context: "两人正在恋爱；关注默契、照顾彼此情绪和日常的亲密感",
    established: true,
  },
  cold: {
    label: "冷战 / 闹别扭",
    group: "恋爱",
    context:
      "两人正在冷战或闹别扭；短回复、冷淡多半和情绪有关，不等于没兴趣。重点看谁在主动缓和、有没有台阶和修复的信号",
    established: true,
  },
  ex: {
    label: "分手后 / 前任",
    group: "分开后",
    context:
      "两人已经分手；友好、客气不等于想复合，要尊重已有的边界，别把怀旧当复燃",
  },
  reconcile: {
    label: "想复合",
    group: "分开后",
    context:
      "两人曾经在一起，现在有复合的可能或意向；关注旧矛盾有没有被正视、双方是否都在靠近",
  },
};
export const RELATION_KEYS = Object.keys(RELATION_INFO) as [
  Relation,
  ...Relation[],
];
export const RELATIONS = Object.fromEntries(
  RELATION_KEYS.map((k) => [k, RELATION_INFO[k].label]),
) as Record<Relation, string>;
/** The relationship line sent to the model. */
export const relationContext = (r: Relation) =>
  `${RELATION_INFO[r].label}：${RELATION_INFO[r].context}`;
export const STAGES: Record<string, string> = {
  unknown: "信息不足",
  contact: "刚搭上线",
  flow: "聊得起来",
  flirt: "出现暧昧",
  date: "有具体约会安排",
  mutual: "明确互表心意",
};
export const ACTIONS: Record<string, { label: string; detail: string }> = {
  continue: { label: "顺着聊", detail: "接住刚才的话题，别急着切换频道。" },
  ask: {
    label: "轻轻追问",
    detail: "问一个具体、容易回答的小问题，把球轻轻递过去。",
  },
  empathize: {
    label: "先接情绪",
    detail: "先回应对方的感受，再考虑讲道理或给建议。",
  },
  flirt: {
    label: "轻轻调情",
    detail: "顺着已经被接住的玩笑，留一点刚刚好的暧昧。",
  },
  invite: {
    label: "试着约一下",
    detail: "把共同兴趣变成一个具体、没有压力的小邀约。",
  },
  clarify: {
    label: "直接问清",
    detail: "这句话有不止一种理解，温和确认比反复猜更有效。",
  },
  wait: {
    label: "等对方接球",
    detail: "球已经递出去了。先留一点空间，不用急着补发。",
  },
  close: {
    label: "今天先收尾",
    detail: "让聊天停在舒服的位置，下次还有话可说。",
  },
  respect: {
    label: "尊重边界",
    detail: "对方表达了拒绝或需要空间。尊重这个意思，停止推进。",
  },
  insufficient: {
    label: "再多一点上下文",
    detail: "这几句话还看不准，补上前后文再一起看看。",
  },
};
export function statusLabel(j?: Judgment) {
  return !j || j.status === "insufficient"
    ? "信息不足"
    : j.status === "clear"
      ? "判断较明确"
      : "有歧义";
}
export function meanQuality(
  messages: Message[],
  lines: Record<string, LineResult>,
) {
  const v = messages
    .filter((m) => m.sender === "self")
    .map((m) => lines[m.id]?.score.value)
    .filter((x): x is number => typeof x === "number");
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}
export function contextKey(messages: Message[], relation: Relation) {
  return JSON.stringify({
    model: MODEL,
    rubric: RUBRIC,
    relation,
    messages: messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      timestamp: m.timestamp,
      kind: m.kind,
    })),
  });
}

export function requestContextKey(input: AnalysisRequest) {
  return (
    contextKey(input.messages, input.relation) +
    (input.note ? JSON.stringify({ note: input.note }) : "") +
    (input.feedback?.length
      ? JSON.stringify({ feedback: input.feedback })
      : "") +
    JSON.stringify(
      (input.memory ?? []).map((e) => ({
        id: e.id,
        kind: e.kind,
        status: e.status,
        resolvedBy: e.resolvedBy,
      })),
    )
  );
}
