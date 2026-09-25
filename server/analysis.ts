import { EVENT_KINDS } from "../shared/memory";
import { AFFINITY_DIMENSIONS, composeAffinity } from "../shared/affinity";
import { MAX_MESSAGES, MAX_TEXT_CHARS } from "../shared/limits";
import { systemOne } from "./llm";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  RUBRIC,
  RELATION_INFO,
  RELATION_KEYS,
  requestContextKey,
  type AnalysisRequest,
  type AnalysisResponse,
} from "../shared/types";
import {
  judgment,
  actionResult,
  safeStage,
  choiceAnswer,
  noulAnswer,
  reasonOf,
  clip,
} from "../shared/rules";
export const requestSchema = z
  .object({
    memory: z
      .array(
        z.object({
          id: z.string().max(80),
          kind: z.enum(
            Object.keys(EVENT_KINDS) as [
              keyof typeof EVENT_KINDS,
              ...(keyof typeof EVENT_KINDS)[],
            ],
          ),
          status: z.enum(["active", "resolved", "uncertain"]),
          resolvedBy: z.string().max(80).optional(),
        }),
      )
      .max(12)
      .optional(),
    revision: z.number().int().nonnegative(),
    relation: z.enum(RELATION_KEYS),
    note: z.string().max(500).optional(),
    feedback: z
      .array(
        z.object({ id: z.string().max(80), text: z.string().min(1).max(300) }),
      )
      .max(20)
      .optional(),
    task: z.enum(["overview", "other_messages", "self_message"]),
    language: z.enum(["zh", "en"]).optional(),
    targetIds: z.array(z.string().max(80)).max(20),
    messages: z
      .array(
        z.object({
          id: z.string().min(1).max(80),
          sender: z.enum(["self", "other"]),
          text: z
            .string()
            .min(1)
            .refine((t) => Array.from(t).length <= MAX_TEXT_CHARS),
          timestamp: z.string().max(80).nullable(),
          kind: z.enum(["text", "unreadable", "system"]),
        }),
      )
      .min(1)
      .max(MAX_MESSAGES),
  })
  .superRefine((v, ctx) => {
    if (
      v.messages.reduce((n, m) => n + Array.from(m.text).length, 0) >
      MAX_TEXT_CHARS
    )
      ctx.addIssue({ code: "custom", message: "聊天过长，请缩小范围" });
    if (
      v.memory?.some(
        (e) =>
          !v.messages.some((m) => m.id === e.id) ||
          (e.resolvedBy && !v.messages.some((m) => m.id === e.resolvedBy)),
      )
    )
      ctx.addIssue({ code: "custom", message: "历史证据缺少原话" });
    if (new Set(v.messages.map((m) => m.id)).size !== v.messages.length)
      ctx.addIssue({ code: "custom", message: "重复消息ID" });
    if (v.targetIds.some((id) => !v.messages.some((m) => m.id === id)))
      ctx.addIssue({ code: "custom", message: "目标消息不存在" });
    if (
      v.task === "self_message" &&
      (!v.targetIds.length ||
        v.targetIds.some(
          (id) => v.messages.find((m) => m.id === id)?.sender !== "self",
        ))
    )
      ctx.addIssue({ code: "custom", message: "我方目标无效" });
    if (
      v.task === "other_messages" &&
      (!v.targetIds.length ||
        v.targetIds.some(
          (id) => v.messages.find((m) => m.id === id)?.sender !== "other",
        ))
    )
      ctx.addIssue({ code: "custom", message: "对方目标无效" });
  });
import { buildRequest } from "../shared/request";
// Re-exported for tests and scripts that build requests from the server side.
export { buildRequest };
export async function analyze(
  input: AnalysisRequest,
  signal?: AbortSignal,
): Promise<AnalysisResponse> {
  const start = performance.now();
  const payload = buildRequest(input);
  // Chat models answer all questions in one generation, and Jev retries stuck
  // calls, so allow a generous deadline.
  const deadline = AbortSignal.timeout(180000);
  const result = await systemOne(
    payload,
    signal ? AbortSignal.any([signal, deadline]) : deadline,
  );
  const a = result.answers;
  const output: AnalysisResponse = {
    revision: input.revision,
    contextHash: createHash("sha256")
      .update(requestContextKey(input))
      .digest("hex"),
    model: result.model,
    rubricVersion: RUBRIC,
    usage: result.usage,
    latencyMs: Math.round(performance.now() - start),
  };
  const evidence = (v: unknown) => {
    const choice = choiceAnswer.parse(v);
    return choice.confidence >= 0.35 &&
      input.messages[Number(choice.choice)]?.id &&
      /^\d+$/.test(choice.choice)
      ? input.messages[Number(choice.choice)].id
      : null;
  };
  if (input.task === "overview") {
    output.memoryUpdates = (input.memory ?? []).map((event) => {
      const status = choiceAnswer.parse(a[`memory_${event.id}_status`]);
      const proof = choiceAnswer.parse(a[`memory_${event.id}_proof`]);
      const proofId = evidence(a[`memory_${event.id}_proof`]);
      const after =
        input.messages.findIndex((m) => m.id === proofId) >
        input.messages.findIndex((m) => m.id === event.id);
      return {
        id: event.id,
        status:
          status.choice === "resolved" &&
          status.confidence >= 0.7 &&
          proof.confidence >= 0.7 &&
          after
            ? ("resolved" as const)
            : status.choice === "active" && status.confidence >= 0.7
              ? ("active" as const)
              : ("uncertain" as const),
        evidenceId: proofId,
      };
    });
    const dimensions = AFFINITY_DIMENSIONS.map((d) => ({
      key: d.key,
      label: d.label,
      weight: d.weight,
      judgment: judgment(a[`affinity_${d.key}`], a[`affinity_${d.key}_enough`]),
    }));
    const composite = composeAffinity(
      dimensions,
      noulAnswer.parse(a.boundary).noul,
    );
    output.overview = {
      memoryEvidenceIds: (input.memory ?? []).flatMap((e) => [
        e.id,
        ...(e.resolvedBy ? [e.resolvedBy] : []),
      ]),
      contextCount: input.messages.length,
      affinity: composite.affinity,
      affinityDimensions: dimensions,
      affinityRawValue: composite.rawValue,
      boundaryApplied: composite.boundaryApplied,
      stage: RELATION_INFO[input.relation].established
        ? "unknown"
        : safeStage(a.stage),
      rapport: RELATION_INFO[input.relation].established
        ? judgment(a.rapport, a.enough)
        : undefined,
      ...actionResult(a.action, a.boundary, a.pending),
      evidenceId: evidence(a.evidence),
      actionEvidenceId: evidence(a.actionEvidence),
      reading: result.context && clip(result.context, 800),
      actionReason: reasonOf(a.action),
    };
  } else
    output.lines = input.targetIds
      .filter((id) => input.messages.find((m) => m.id === id)?.kind === "text")
      .map((id) => {
        const eventAnswer = choiceAnswer.parse(a[`${id}_event`]);
        const event = {
          kind: (eventAnswer.choice in EVENT_KINDS
            ? eventAnswer.choice
            : "none") as keyof typeof EVENT_KINDS,
          confidence: eventAnswer.confidence,
        };
        if (input.task === "other_messages") {
          const emotions = choiceAnswer.parse(a[`${id}_emotions`]);
          const intents = choiceAnswer.parse(a[`${id}_intents`]);
          const incomplete =
            !Object.keys(emotions.probabilities).length ||
            !Object.keys(intents.probabilities).length;
          return {
            id,
            event,
            ...(incomplete ? { incomplete } : {}),
            emotions: emotions.probabilities,
            intents: intents.probabilities,
            reasons: {
              emotion: reasonOf(a[`${id}_emotions`]),
              intent: reasonOf(a[`${id}_intents`]),
            },
            score: {
              value: null,
              confidence: emotions.confidence,
              status: "ambiguous" as const,
              probabilities: {},
            },
          };
        }
        const score = judgment(a[`${id}_score`], a[`${id}_enough`]);
        return {
          id,
          event,
          ...(Object.keys(score.probabilities).length
            ? {}
            : { incomplete: true }),
          score,
        };
      });
  return output;
}
