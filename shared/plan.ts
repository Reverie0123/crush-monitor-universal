// Decides what an analysis run will send. Used both to run and to estimate cost,
// so the estimate always describes exactly what would happen.
import { incrementalJobs, overviewJob } from "./incremental";
import { requestLimits } from "./limits";
import { boundedContext, type MemoryEvent } from "./memory";
import { parseTime, periods as splitPeriods } from "./context";
import type {
  AnalysisRequest,
  LineResult,
  Message,
  Period,
  Relation,
} from "./types";

export type Level = "quick" | "standard" | "full";
export const LEVELS: Record<Level, { label: string; detail: string }> = {
  quick: {
    label: "快速",
    detail: "只看整体好感、各维度、走势和下一步建议，不逐句分析，最省钱",
  },
  standard: {
    label: "标准",
    detail: "在快速的基础上，逐句分析对方消息的情绪和意图",
  },
  full: {
    label: "完整",
    detail: "在标准的基础上，再给你自己的每条回复打分、写评价",
  },
};
/** days: only analyze lines from the last N days of the chat; null means all. */
export type Scope = { level: Level; days: number | null };
export const DEFAULT_SCOPE: Scope = { level: "full", days: null };

/** What the previous runs left behind. */
export type RunState = {
  prior: {
    messages: Message[];
    relation: Relation;
    note: string;
    /** Language the model wrote the reasons in; results before v2.4 are zh. */
    language?: "zh" | "en";
  } | null;
  /**
   * Language the next run would write in; left out when it doesn't matter
   * (Jev writes no reasons).
   */
  language?: "zh" | "en";
  processed: number;
  /** Results come from older analysis rules and must all be redone. */
  stale: boolean;
  lines: Record<string, LineResult>;
  events: Record<string, MemoryEvent>;
  periods: Period[];
  /** The user's own explanations for specific messages (see reconsider). */
  corrections: Record<string, string>;
};

const TOO_LONG = 12000;

/** Line-by-line analysis is limited by level and date range; the overview always reads everything. */
export function scopeFilter(messages: Message[], scope: Scope) {
  const senders =
    scope.level === "full"
      ? ["self", "other"]
      : scope.level === "standard"
        ? ["other"]
        : [];
  let from = 0;
  if (scope.days) {
    const year = messages
      .map((m) => parseTime(m.timestamp))
      .find((d) => d)
      ?.getFullYear();
    const times = messages.map((m) => parseTime(m.timestamp, year)?.getTime());
    const last = Math.max(...times.filter((t): t is number => t !== undefined));
    if (Number.isFinite(last)) {
      const cutoff = last - scope.days * 86400000;
      const i = times.findIndex((t) => t !== undefined && t >= cutoff);
      if (i > 0) from = i;
    }
  }
  const index = new Map(messages.map((m, i) => [m.id, i]));
  return (m: Message) =>
    senders.includes(m.sender) && (index.get(m.id) ?? 0) >= from;
}

export function periodJob(
  messages: Message[],
  g: { start: number; end: number },
  relation: Relation,
  revision: number,
  events: Record<string, MemoryEvent>,
): AnalysisRequest {
  return {
    task: "overview",
    targetIds: [],
    revision,
    relation,
    ...boundedContext(
      messages,
      Math.max(0, g.start - 100),
      g.end + 1,
      events,
      true,
      {
        count: requestLimits.periodMessages,
        chars: requestLimits.periodChars,
      },
    ),
  };
}

/** Adds the relationship note and any user corrections for the job's targets. */
export function finishJob(
  job: AnalysisRequest,
  note: string,
  corrections: Record<string, string>,
): AnalysisRequest {
  const feedback = job.targetIds
    .filter((id) => corrections[id])
    .map((id) => ({ id, text: corrections[id] }));
  return {
    ...job,
    ...(note.trim() ? { note: note.trim() } : {}),
    ...(feedback.length ? { feedback } : {}),
  };
}

export function planRun(
  messages: Message[],
  relation: Relation,
  note: string,
  scope: Scope,
  state: RunState,
  revision = 0,
) {
  const prior = state.prior;
  const append =
    !state.stale &&
    !!prior &&
    prior.relation === relation &&
    // New background changes how every line reads, like a new relation.
    prior.note === note &&
    // Reasons written in the other language are redone, not mixed.
    (!state.language || (prior.language ?? "zh") === state.language) &&
    prior.messages.length <= messages.length &&
    prior.messages.every(
      (m, i) =>
        m.id === messages[i].id &&
        m.sender === messages[i].sender &&
        m.text === messages[i].text &&
        m.timestamp === messages[i].timestamp,
    );
  const changed = !append || messages.length !== state.processed;
  const lines: Record<string, LineResult> = append ? { ...state.lines } : {};
  const events: Record<string, MemoryEvent> = append ? { ...state.events } : {};
  for (const m of messages)
    if (m.kind === "text" && Array.from(m.text).length > TOO_LONG)
      lines[m.id] = {
        id: m.id,
        skipped: "单条超过12,000字，已保存，请拆分后分析",
        score: {
          value: null,
          confidence: 0,
          status: "insufficient",
          probabilities: {},
        },
      };
  const jobs =
    scope.level === "quick"
      ? []
      : incrementalJobs(
          messages,
          relation,
          revision,
          lines,
          events,
          changed,
          scopeFilter(messages, scope),
        );
  // A fresh run goes oldest first so later lines can use earlier events.
  if (!append) jobs.reverse();
  const known = new Map(
    (append ? state.periods : []).map((p) => [`${p.startId}|${p.endId}`, p]),
  );
  const groups = splitPeriods(messages);
  const periods =
    groups.length >= 2
      ? groups.map((g) => ({
          ...g,
          reuse: known.get(`${messages[g.start].id}|${messages[g.end].id}`),
        }))
      : [];
  return {
    append,
    changed,
    needed: messages.length > 0 && (changed || jobs.length > 0),
    lines,
    events,
    jobs: jobs.map((j) => finishJob(j, note, state.corrections)),
    periods,
    lineCount: new Set(jobs.flatMap((j) => j.targetIds)).size,
  };
}

/** Every request a run would send, for cost estimation. */
export function plannedRequests(
  messages: Message[],
  relation: Relation,
  note: string,
  plan: ReturnType<typeof planRun>,
) {
  const overview = finishJob(
    overviewJob(messages, relation, 0, plan.events),
    note,
    {},
  );
  const periodJobs = plan.periods
    .filter((p) => !p.reuse)
    .map((p) =>
      finishJob(periodJob(messages, p, relation, 0, plan.events), note, {}),
    );
  // With line jobs there is a provisional overview first and a final one after.
  const overviews = plan.jobs.length ? [overview, overview] : [overview];
  return [...overviews, ...plan.jobs, ...periodJobs];
}
