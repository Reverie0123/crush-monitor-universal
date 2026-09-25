import { useRef, useState } from "react";
import { apiFetch } from "./api";
import { overviewJob } from "../shared/incremental";
import { estimateJobs } from "../shared/estimate";
import {
  DEFAULT_SCOPE,
  finishJob,
  periodJob,
  planRun,
  plannedRequests,
  type RunState,
  type Scope,
} from "../shared/plan";
import {
  collectEvents,
  boundedContext,
  type MemoryEvent,
} from "../shared/memory";
import {
  RUBRIC,
  requestContextKey,
  type Message,
  type Relation,
  type Overview,
  type LineResult,
  type AnalysisRequest,
  type AnalysisResponse,
  type Period,
} from "../shared/types";
import type { SavedConversation, Trend } from "./storage";
import { overLimit, requestLimits } from "../shared/limits";
import { currentLang, errorText, messages as currentText } from "./i18n";
type Progress = {
  done: number;
  total: number;
  startedAt: number;
  /** The chat exceeds one request's limit and is sent in pieces. */
  batched: boolean;
  /** 1-based positions of the messages in the request being sent. */
  range: [number, number] | null;
  /** Messages in the chat being analyzed. */
  count: number;
};
const IDLE: Progress = {
  done: 0,
  total: 0,
  startedAt: 0,
  batched: false,
  range: null,
  count: 0,
};
export type UsageTotal = {
  input: number;
  output: number;
  cached: number;
  requests: number;
};
export const NO_USAGE: UsageTotal = {
  input: 0,
  output: 0,
  cached: 0,
  requests: 0,
};
const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(done, ms);
    function done() {
      signal.removeEventListener("abort", abort);
      resolve();
    }
    function abort() {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
async function sha256(text: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export function useAnalysis() {
  const [overview, setOverview] = useState<Overview | null>(null),
    [overviewFresh, setOverviewFresh] = useState(false),
    [lines, setLines] = useState<Record<string, LineResult>>({}),
    [events, setEvents] = useState<Record<string, MemoryEvent>>({}),
    [trend, setTrend] = useState<Trend[]>([]),
    [status, setStatus] = useState<"idle" | "loading" | "complete" | "error">(
      "idle",
    ),
    [error, setError] = useState(""),
    [progress, setProgress] = useState<Progress>(IDLE),
    [latency, setLatency] = useState(0),
    [analyzedCount, setAnalyzedCount] = useState(0),
    [usage, setUsage] = useState<UsageTotal>(NO_USAGE),
    [periods, setPeriods] = useState<Period[]>([]),
    [scope, setScopeState] = useState<Scope>(DEFAULT_SCOPE),
    [corrections, setCorrections] = useState<Record<string, string>>({}),
    // Results from older analysis rules: shown, but a new run redoes everything.
    [stale, setStale] = useState(false),
    [reconsidering, setReconsidering] = useState<string | null>(null),
    [retrying, setRetrying] = useState<string[]>([]);
  const note = useRef("");
  const rev = useRef(0),
    controller = useRef<AbortController | null>(null),
    prior = useRef<RunState["prior"]>(null),
    savedLines = useRef(lines),
    savedEvents = useRef(events),
    savedPeriods = useRef<Period[]>([]),
    savedCorrections = useRef(corrections),
    staleRef = useRef(false),
    processed = useRef(0);

  const runState = (): RunState => ({
    prior: prior.current,
    processed: processed.current,
    stale: staleRef.current,
    lines: savedLines.current,
    events: savedEvents.current,
    periods: savedPeriods.current,
    corrections: savedCorrections.current,
  });
  function markStale(value: boolean) {
    staleRef.current = value;
    setStale(value);
  }
  function commitLines(next: Record<string, LineResult>) {
    savedLines.current = next;
    setLines(next);
  }
  function commitEvents(next: Record<string, MemoryEvent>) {
    savedEvents.current = next;
    setEvents(next);
  }

  function cancel() {
    rev.current++;
    controller.current?.abort();
    setStatus("idle");
  }
  /** keepUsage: money already spent stays on the counter (e.g. after swapping roles). */
  function reset(keepUsage = false) {
    cancel();
    prior.current = null;
    processed.current = 0;
    commitLines({});
    commitEvents({});
    setTrend([]);
    setOverview(null);
    setOverviewFresh(false);
    setError("");
    setLatency(0);
    setAnalyzedCount(0);
    if (!keepUsage) setUsage(NO_USAGE);
    savedPeriods.current = [];
    setPeriods([]);
    savedCorrections.current = {};
    setCorrections({});
    markStale(false);
  }
  function restore(s: SavedConversation) {
    reset();
    note.current = s.note ?? "";
    // Compare future runs against what the results were produced with, not the
    // current settings, so a relation or note change survives a reload.
    prior.current = {
      messages: s.messages,
      relation: s.analyzedWith?.relation ?? s.relation,
      note: s.analyzedWith?.note ?? note.current,
    };
    // Spend is real money already paid, so it survives a rubric change.
    setUsage(s.usage ?? NO_USAGE);
    setScopeState(s.scope ?? DEFAULT_SCOPE);
    savedCorrections.current = s.corrections ?? {};
    setCorrections(savedCorrections.current);
    // Results from older rules stay visible; the next run redoes them.
    markStale(s.rubric !== RUBRIC);
    savedPeriods.current = s.periods ?? [];
    setPeriods(savedPeriods.current);
    commitLines(s.lines);
    commitEvents(s.events);
    processed.current = s.analyzedCount;
    setTrend(s.trend);
    setOverview(s.overview);
    setOverviewFresh(s.completed && s.rubric === RUBRIC);
    setAnalyzedCount(s.analyzedCount);
    setStatus(s.completed && s.rubric === RUBRIC ? "complete" : "idle");
  }

  /** Sends one job, retrying on rate limits, and checks the reply matches it. */
  async function send(job: AnalysisRequest, signal: AbortSignal) {
    let data: AnalysisResponse | undefined;
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await apiFetch("/api/analyze", {
        method: "POST",
        body: JSON.stringify({ ...job, language: currentLang() }),
        signal,
      });
      if ([429, 529].includes(response.status) && attempt < 3) {
        await pause(
          Math.min(
            60000,
            Number(response.headers.get("retry-after") || 2 ** attempt) * 1000,
          ),
          signal,
        );
        continue;
      }
      const body = await response.json();
      if (!response.ok)
        throw new Error(errorText(body, currentText().errors.analysisFailed));
      data = body;
      break;
    }
    if (
      !data ||
      data.revision !== job.revision ||
      data.rubricVersion !== RUBRIC
    )
      throw new Error(currentText().errors.revisionMismatch);
    if ((await sha256(requestContextKey(job))) !== data.contextHash)
      throw new Error(currentText().errors.contextMismatch);
    const u = data.usage;
    setUsage((t) => ({
      input: t.input + u.input_tokens,
      output: t.output + u.output_tokens,
      cached: t.cached + (u.cached_tokens ?? 0),
      requests: t.requests + 1,
    }));
    return data;
  }
  /** Folds a reply's lines, events and event-status updates into the results. */
  function merge(data: AnalysisResponse) {
    const added = Object.fromEntries((data.lines ?? []).map((l) => [l.id, l]));
    const nextEvents = collectEvents(added, savedEvents.current);
    for (const update of data.memoryUpdates ?? []) {
      const old = nextEvents[update.id];
      if (old)
        nextEvents[update.id] = {
          ...old,
          status: update.status,
          resolvedBy:
            update.status === "resolved"
              ? (update.evidenceId ?? undefined)
              : update.status === "uncertain"
                ? old.resolvedBy
                : undefined,
        };
    }
    commitLines({ ...savedLines.current, ...added });
    commitEvents(nextEvents);
  }

  /** Resolves false when nothing could be sent, true once a run has started. */
  async function run(
    messages: Message[],
    relation: Relation,
  ): Promise<boolean> {
    const revision = ++rev.current;
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    const started = performance.now();
    const plan = planRun(
      messages,
      relation,
      note.current,
      scope,
      runState(),
      revision,
    );
    setStatus("loading");
    setError("");
    setOverviewFresh(false);
    if (!plan.append) {
      setTrend([]);
      setOverview(null);
      processed.current = 0;
      setAnalyzedCount(0);
      // Periods scored under the old relation, note or rules must not be reused
      // if this run is stopped part-way and then continued.
      savedPeriods.current = [];
      setPeriods([]);
    }
    markStale(false);
    prior.current = { messages, relation, note: note.current };
    commitLines(plan.lines);
    commitEvents(plan.events);
    const jobs = [...plan.jobs];
    const first = overviewJob(messages, relation, revision, plan.events);
    if (!first.messages.length) {
      setStatus("error");
      setError(currentText().errors.nothingToAnalyze);
      // Nothing was sent; lets the caller drop what it prepared for this run.
      return false;
    }
    const pendingPeriods = plan.periods.filter((p) => !p.reuse).length;
    let failed = 0;
    // A chat too long for one request goes out in pieces; say which piece.
    const batched = overLimit(messages.map((m) => m.text));
    const position = new Map(messages.map((m, i) => [m.id, i]));
    const show = (job: AnalysisRequest) => {
      if (!batched || rev.current !== revision || !job.messages.length) return;
      const at = (id: string) => position.get(id) ?? 0;
      let from: number, to: number;
      if (job.targetIds.length) {
        // Line jobs: the lines being judged, not their surrounding context.
        const ids = job.targetIds.map(at);
        from = Math.min(...ids);
        to = Math.max(...ids);
      } else {
        // Overview and trend: the continuous stretch they read, without the
        // earlier event originals that are sent along with it.
        const read = job.messages.map((m) => at(m.id));
        // Messages over 12,000 characters are never sent; they don't break
        // the stretch.
        const skipped = (a: number, b: number) =>
          messages
            .slice(a + 1, b)
            .every((m) => Array.from(m.text).length > 12000);
        let i = read.length - 1;
        while (i > 0 && skipped(read[i - 1], read[i])) i--;
        from = read[i];
        to = read.at(-1)!;
      }
      setProgress((p) => ({ ...p, range: [from + 1, to + 1] }));
    };
    setProgress({
      done: 0,
      total: jobs.length + (jobs.length ? 2 : 1) + pendingPeriods,
      startedAt: Date.now(),
      batched,
      range: null,
      count: messages.length,
    });
    const tick = () => {
      if (rev.current === revision)
        setProgress((p) => ({ ...p, done: p.done + 1 }));
    };
    const finish = (job: AnalysisRequest) =>
      finishJob(job, note.current, savedCorrections.current);
    async function safely(job: AnalysisRequest) {
      show(job);
      try {
        const data = await send(finish(job), ctrl.signal);
        if (rev.current !== revision) return;
        if (data.overview) {
          setOverview(data.overview);
          setLatency(Math.round(performance.now() - started));
        }
        merge(data);
        return data;
      } catch (e) {
        if (!ctrl.signal.aborted) {
          failed++;
          setError((e as Error).message);
        }
      } finally {
        tick();
      }
    }
    // With line jobs, a provisional overview comes first; the final one follows.
    if (jobs.length) await safely(first);
    async function worker() {
      while (jobs.length && rev.current === revision) {
        const job = jobs.shift()!;
        // Refresh retrieved evidence as earlier chunks finish extracting events.
        const positions = job.targetIds.map((id) =>
          messages.findIndex((m) => m.id === id),
        );
        const firstTarget = Math.min(...positions),
          lastTarget = Math.max(...positions);
        const revised = boundedContext(
          messages,
          Math.max(0, firstTarget - requestLimits.lineContext),
          job.task === "self_message"
            ? lastTarget + 1
            : Math.min(messages.length, lastTarget + 21),
          savedEvents.current,
          job.task === "self_message",
        );
        // Keep deliberately retrieved distant corrections paired with the newest context.
        if (job.memory?.some((e) => job.targetIds.includes(e.id)))
          await safely(job);
        else if (
          job.targetIds.every((id) => revised.messages.some((m) => m.id === id))
        )
          await safely({ ...job, ...revised });
        else await safely(job);
      }
    }
    // Parallel per-line jobs (the server allows 12 in flight); fewer for Jev.
    await Promise.all(Array.from({ length: requestLimits.workers }, worker));
    if (rev.current !== revision) return true;
    const final = await safely(
      overviewJob(messages, relation, revision, savedEvents.current),
    );
    if (rev.current !== revision) return true;
    // Trend: one overview per week (or even chunk), reusing unchanged periods.
    if (plan.periods.length) {
      const out: (Period | undefined)[] = plan.periods.map((p) => p.reuse);
      const todo = plan.periods.flatMap((p, i) => (p.reuse ? [] : [i]));
      async function periodWorker() {
        while (todo.length && rev.current === revision) {
          const i = todo.shift()!,
            g = plan.periods[i];
          try {
            const job = periodJob(
              messages,
              g,
              relation,
              revision,
              savedEvents.current,
            );
            show(job);
            const data = await send(finish(job), ctrl.signal);
            if (data.overview)
              out[i] = {
                label: g.label,
                startId: messages[g.start].id,
                endId: messages[g.end].id,
                count: g.end - g.start + 1,
                value: data.overview.affinity.value,
                reading: data.overview.reading,
                evidenceId: data.overview.evidenceId,
              };
          } catch {
            // A missing trend point is shown as a gap, not an analysis failure.
          } finally {
            tick();
          }
        }
      }
      await Promise.all(
        Array.from(
          { length: Math.min(3, requestLimits.workers) },
          periodWorker,
        ),
      );
      if (rev.current !== revision) return true;
      savedPeriods.current = out.filter((p): p is Period => !!p);
      setPeriods(savedPeriods.current);
    }
    setOverviewFresh(!!final?.overview && !failed);
    setStatus(failed ? "error" : "complete");
    if (final?.overview && !failed) {
      processed.current = messages.length;
      setAnalyzedCount(messages.length);
      setTrend((old) => {
        const point = {
          at: new Date().toISOString(),
          value: final.overview!.affinity.value,
          count: messages.length,
        };
        return old.at(-1)?.count === point.count
          ? [...old.slice(0, -1), point]
          : [...old, point];
      });
    }
    return true;
  }

  /**
   * What run() would do right now, without sending anything: how many lines it
   * covers and the estimated token usage. Null when there is nothing to do.
   */
  function plan(messages: Message[], relation: Relation) {
    const p = planRun(messages, relation, note.current, scope, runState());
    if (!p.needed) return null;
    return {
      lines: p.lineCount,
      batched: overLimit(messages.map((m) => m.text)),
      estimate: estimateJobs(
        plannedRequests(messages, relation, note.current, p),
      ),
    };
  }

  /**
   * Re-judges one message with the user's explanation of it. The explanation is
   * kept, so later full runs judge that message with it too.
   */
  /** A request for exactly one message, with the context a full run would give it. */
  function lineJob(id: string, messages: Message[], relation: Relation) {
    const i = messages.findIndex((m) => m.id === id);
    const m = messages[i];
    if (!m || m.kind !== "text") return null;
    const self = m.sender === "self";
    return finishJob(
      {
        task: self ? "self_message" : "other_messages",
        targetIds: [id],
        revision: rev.current,
        relation,
        ...boundedContext(
          messages,
          Math.max(0, i - requestLimits.lineContext),
          self ? i + 1 : Math.min(messages.length, i + 21),
          savedEvents.current,
          self,
        ),
      },
      note.current,
      savedCorrections.current,
    );
  }
  /**
   * Sends single-message jobs outside a full run. Replies that arrive after a
   * reset, swap or new run are dropped, so they can't attach to a changed chat.
   */
  async function sendLines(
    jobs: AnalysisRequest[],
    tag: (l: LineResult) => LineResult = (l) => l,
    signal: AbortSignal = AbortSignal.timeout(180000),
    onEach: () => void = () => {},
  ) {
    const revision = rev.current;
    for (const job of jobs) {
      const data = await send(job, signal);
      if (rev.current !== revision) return;
      merge({ ...data, lines: data.lines?.map(tag) });
      onEach();
    }
  }

  /**
   * Re-judges one message with the user's explanation of it. The explanation is
   * kept, so later full runs judge that message with it too.
   */
  async function reconsider(
    id: string,
    text: string,
    messages: Message[],
    relation: Relation,
  ) {
    const nextCorrections = { ...savedCorrections.current, [id]: text.trim() };
    savedCorrections.current = nextCorrections;
    setCorrections(nextCorrections);
    const job = lineJob(id, messages, relation);
    if (!job) return;
    setReconsidering(id);
    try {
      await sendLines([job], (l) => ({ ...l, correction: text.trim() }));
    } finally {
      setReconsidering(null);
    }
  }

  /**
   * Re-sends only the given lines, one request each. Unlike a run it never
   * re-plans, so it cannot turn into an unannounced full analysis.
   */
  async function retry(ids: string[], messages: Message[], relation: Relation) {
    // Counts as a (small) run: shows progress and a stop button, and the
    // spending cap watches it like any other run.
    const before = status;
    const revision = ++rev.current;
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    const jobs = ids
      .map((id) => lineJob(id, messages, relation))
      .filter((j): j is AnalysisRequest => !!j);
    if (!jobs.length) return;
    setStatus("loading");
    setProgress({ ...IDLE, total: jobs.length, startedAt: Date.now() });
    setRetrying(ids);
    setError("");
    let failed = false;
    try {
      await sendLines(
        jobs,
        undefined,
        AbortSignal.any([ctrl.signal, AbortSignal.timeout(180000)]),
        () => setProgress((p) => ({ ...p, done: p.done + 1 })),
      );
    } catch (e) {
      failed = !ctrl.signal.aborted;
      if (failed) setError((e as Error).message);
    } finally {
      setRetrying([]);
      // Stopped or superseded runs have already set their own status.
      if (rev.current === revision)
        setStatus(failed ? "error" : before === "loading" ? "idle" : before);
    }
  }
  /** What retry() would send, for its price tag. */
  function retryEstimate(
    ids: string[],
    messages: Message[],
    relation: Relation,
  ) {
    return estimateJobs(
      ids
        .map((id) => lineJob(id, messages, relation))
        .filter((j): j is AnalysisRequest => !!j),
    );
  }
  /** Adds usage from requests made outside the hook (e.g. reply suggestions). */
  function addUsage(u: {
    input_tokens: number;
    output_tokens: number;
    cached_tokens?: number;
  }) {
    setUsage((t) => ({
      input: t.input + u.input_tokens,
      output: t.output + u.output_tokens,
      cached: t.cached + (u.cached_tokens ?? 0),
      requests: t.requests + 1,
    }));
  }
  /** The relation and note the current results were produced with. */
  const analyzedWith = () =>
    prior.current
      ? { relation: prior.current.relation, note: prior.current.note }
      : undefined;
  /** Attaches extra data (e.g. reply suggestions) to an analyzed line. */
  function annotate(id: string, patch: Partial<LineResult>) {
    const old = savedLines.current[id];
    if (!old) return;
    commitLines({ ...savedLines.current, [id]: { ...old, ...patch } });
  }
  return {
    plan,
    scope,
    setScope: setScopeState,
    corrections,
    reconsider,
    reconsidering,
    retrying,
    stale,
    usage,
    periods,
    retry,
    retryEstimate,
    addUsage,
    analyzedWith,
    annotate,
    setNote: (value: string) => {
      note.current = value;
    },
    overview,
    overviewFresh,
    lines,
    events,
    trend,
    status,
    error,
    clearError: () => setError(""),
    progress,
    latency,
    analyzedCount,
    run,
    cancel,
    reset,
    restore,
  };
}

export type Analysis = ReturnType<typeof useAnalysis>;
