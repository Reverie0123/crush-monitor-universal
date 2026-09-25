import { Modal, Reason } from "./ui";
import { REPLY_RATINGS } from "../../shared/ratings";
import type { Message, Overview } from "../../shared/types";
import { judgmentText, useT } from "../i18n";

export type OverviewKind = "overview" | "action" | "performance";

export function OverviewDetail({
  kind,
  ov,
  messages,
  self,
  other,
  quality,
  stale,
  close,
}: {
  kind: OverviewKind;
  ov: Overview | null;
  messages: Message[];
  self: string;
  other: string;
  quality: number | null;
  stale: boolean;
  close: () => void;
}) {
  const t = useT();
  const find = (id: string | null) => messages.find((m) => m.id === id);
  const dimension = (key: string, fallback: string) =>
    key in t.dimensions
      ? t.dimensions[key as keyof typeof t.dimensions]
      : fallback;
  return (
    <Modal title={t.overview.titles[kind]} close={close}>
      {stale && <p className="stale-note">{t.overview.staleNote}</p>}
      {kind === "overview" ? (
        <>
          {ov?.reading && (
            <Reason title={t.overview.reading}>{ov.reading}</Reason>
          )}
          <p>{t.overview.scoreNote}</p>
          <p>{t.overview.basisNote}</p>
          {!!ov?.memoryEvidenceIds?.length && (
            <details>
              <summary>{t.overview.history}</summary>
              {[...new Set(ov.memoryEvidenceIds)].map((id) => {
                const m = find(id);
                return m ? (
                  <blockquote key={id}>
                    {m.sender === "self" ? self : other}
                    {t.colon}
                    {m.text}
                  </blockquote>
                ) : null;
              })}
            </details>
          )}
          {ov?.affinityDimensions && (
            <div className="affinity-breakdown">
              {ov.affinityDimensions.map((d) => (
                <div key={d.key}>
                  <span>{dimension(d.key, d.label)}</span>
                  <meter
                    min="0"
                    max="100"
                    value={d.judgment.value ?? 0}
                    aria-label={t.overview.dimAria(
                      dimension(d.key, d.label),
                      String(d.judgment.value),
                    )}
                  />
                  <strong>{d.judgment.value}</strong>
                  <small>
                    {t.overview.weight(d.weight, judgmentText(t, d.judgment))}
                  </small>
                  {d.judgment.reason && (
                    <p className="dimension-reason">{d.judgment.reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {ov?.boundaryApplied && (
            <p>{t.overview.boundaryCap(String(ov.affinityRawValue))}</p>
          )}
          {ov && (
            <p>
              {t.overview.verdict(
                judgmentText(t, ov.affinity),
                `${Math.round(ov.affinity.confidence * 100)}%`,
              )}
            </p>
          )}
        </>
      ) : kind === "action" ? (
        <>
          <h3>{ov ? t.actions[ov.action]?.label : t.overview.waiting}</h3>
          <p>{ov ? t.actions[ov.action]?.detail : t.overview.waitingDetail}</p>
          {ov?.actionReason && <Reason>{ov.actionReason}</Reason>}
          {ov?.actionEvidenceId && (
            <blockquote>{find(ov.actionEvidenceId)?.text}</blockquote>
          )}
        </>
      ) : (
        <>
          <div className="detail-score">
            {quality ?? t.dash}
            <span>/100</span>
          </div>
          <p>{t.overview.performanceNote}</p>
          <div className="reply-guide">
            {REPLY_RATINGS.map((v) => (
              <p key={v.label}>
                <strong>{t.overview.ratingRange(v.label, v.range)}</strong>
                {t.colon}
                {t.ratings[v.label]}
              </p>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
