import { Modal, Reason } from "./ui";
import { REPLY_RATINGS } from "../../shared/ratings";
import {
  ACTIONS,
  statusLabel,
  type Message,
  type Overview,
} from "../../shared/types";

export type OverviewKind = "overview" | "action" | "performance";
const TITLES: Record<OverviewKind, string> = {
  overview: "好感度",
  action: "下一步",
  performance: "我的发挥",
};

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
  const find = (id: string | null) => messages.find((m) => m.id === id);
  return (
    <Modal title={TITLES[kind]} close={close}>
      {stale && (
        <p className="stale-note">
          这是旧版分析规则的结果，仅供查看。点底部「开始分析」可以按新规则重新分析。
        </p>
      )}
      {kind === "overview" ? (
        <>
          {ov?.reading && <Reason title="模型的整体解读">{ov.reading}</Reason>}
          <p>
            0—100 是模型对这段聊天的好感信号评分，不是「对方喜欢你的概率」。
          </p>
          <p>
            根据近期对话和相关历史原话评分，旧分数不参与计算。证据少时仍保留分数供娱乐参考。
          </p>
          {!!ov?.memoryEvidenceIds?.length && (
            <details>
              <summary>参考的历史原话</summary>
              {[...new Set(ov.memoryEvidenceIds)].map((id) => {
                const m = find(id);
                return m ? (
                  <blockquote key={id}>
                    {m.sender === "self" ? self : other}：{m.text}
                  </blockquote>
                ) : null;
              })}
            </details>
          )}
          {ov?.affinityDimensions && (
            <div className="affinity-breakdown">
              {ov.affinityDimensions.map((d) => (
                <div key={d.key}>
                  <span>{d.label}</span>
                  <meter
                    min="0"
                    max="100"
                    value={d.judgment.value ?? 0}
                    aria-label={`${d.label} ${d.judgment.value} 分`}
                  />
                  <strong>{d.judgment.value}</strong>
                  <small>
                    占 {d.weight}% · {statusLabel(d.judgment)}
                  </small>
                  {d.judgment.reason && (
                    <p className="dimension-reason">{d.judgment.reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {ov?.boundaryApplied && (
            <p>
              对方表达了明确且仍有效的拒绝边界。综合原分 {ov.affinityRawValue}
              ，最终好感度最多显示 25 分。
            </p>
          )}
          {ov && (
            <p>
              本轮判断：{statusLabel(ov.affinity)}。综合确定度{" "}
              {Math.round(ov.affinity.confidence * 100)}%。
            </p>
          )}
        </>
      ) : kind === "action" ? (
        <>
          <h3>{ov ? ACTIONS[ov.action]?.label : "等待聊天"}</h3>
          <p>{ov ? ACTIONS[ov.action]?.detail : "导入后生成建议。"}</p>
          {ov?.actionReason && <Reason>{ov.actionReason}</Reason>}
          {ov?.actionEvidenceId && (
            <blockquote>{find(ov.actionEvidenceId)?.text}</blockquote>
          )}
        </>
      ) : (
        <>
          <div className="detail-score">
            {quality ?? "—"}
            <span>/100</span>
          </div>
          <p>
            已完成分析的我方回复平均分。模型根据发出时的前文评价表达质量，再按固定分数区间显示评级。「快速」「标准」档不给你的回复打分。
          </p>
          <div className="reply-guide">
            {REPLY_RATINGS.map((v) => (
              <p key={v.label}>
                <strong>
                  {v.label} · {v.range} 分
                </strong>
                ：{v.description}
              </p>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
