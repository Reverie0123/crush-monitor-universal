import { RotateCcw } from "lucide-react";
import { Avatar } from "../AvatarPicker";
import type { Avatars } from "../storage";
import { topEmotions } from "../../shared/labels";
import { topIntents } from "../../shared/intents";
import { replyRating } from "../../shared/ratings";
import type { LineResult, Message } from "../../shared/types";

const PENDING_TIP = "点底部的「开始分析」统一分析，开始前会先显示预计花费";

export function MessageRow({
  m,
  prev,
  r,
  busy,
  avatars,
  self,
  other,
  onOpen,
  onRetry,
}: {
  m: Message;
  prev?: Message;
  r?: LineResult;
  busy: boolean;
  avatars: Avatars;
  self: string;
  other: string;
  onOpen: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const pending = (
    <span className="pending-tag" title={PENDING_TIP}>
      {busy ? "分析中" : "待分析"}
    </span>
  );
  return (
    <>
      {(!prev || m.timestamp !== prev.timestamp) && m.timestamp && (
        <div className="timestamp">{m.timestamp.replace(/^\d{4}年/, "")}</div>
      )}
      {m.kind === "system" ? (
        <div
          className="system-notice"
          title="系统提示，不单独分析，仅作为上下文参考"
        >
          {m.text}
        </div>
      ) : (
        <div className="message-row">
          <Avatar
            src={avatars[m.sender]}
            name={m.sender === "self" ? self : other}
            mine={m.sender === "self"}
          />
          <div className="message-content">
            <div
              className={`bubble ${m.kind === "unreadable" ? "unreadable" : ""}`}
              title={
                m.kind === "unreadable"
                  ? "看不到具体内容，不单独分析，仅作为上下文参考"
                  : undefined
              }
            >
              {m.text}
            </div>
            {m.kind === "text" && (
              <div className={`message-tags ${m.sender}`}>
                {r?.skipped ? (
                  <span className="pending-tag">{r.skipped}</span>
                ) : r?.incomplete ? (
                  <button
                    className="pending-tag retry-tag"
                    disabled={busy}
                    onClick={() => onRetry(m.id)}
                    title="模型这次没有给出完整结果，可以单独重试这一条"
                  >
                    <RotateCcw size={12} /> 未完成，重试这条
                  </button>
                ) : m.sender === "other" ? (
                  <>
                    <div className="analysis-row emotion-row">
                      <span className="analysis-row-label">情绪</span>
                      {r?.emotions
                        ? topEmotions(r.emotions).map((emotion) => (
                            <button
                              key={emotion.key}
                              className={`emotion-tag emotion-${emotion.key}`}
                              onClick={() => onOpen(m.id)}
                              title={r.reasons?.emotion}
                              aria-label={`${emotion.label} ${emotion.percent}，查看情绪分析：${m.text}`}
                            >
                              <span>{emotion.label}</span>
                              <b>{emotion.percent}</b>
                            </button>
                          ))
                        : pending}
                    </div>
                    <div className="analysis-row intent-row">
                      <span className="analysis-row-label">意图</span>
                      {r?.intents
                        ? topIntents(r.intents).map((intent) => (
                            <button
                              key={intent.key}
                              className="intent-tag"
                              onClick={() => onOpen(m.id)}
                              title={r.reasons?.intent}
                              aria-label={`${intent.label} ${intent.percent}，查看意图分析：${m.text}`}
                            >
                              <span>{intent.label}</span>
                              <b>{intent.percent}</b>
                            </button>
                          ))
                        : pending}
                    </div>
                  </>
                ) : r ? (
                  <button
                    className="reply-tag"
                    onClick={() => onOpen(m.id)}
                    title={r.score.reason}
                    aria-label={`查看回复评价：${m.text}`}
                  >
                    <span>回复评级：</span>
                    <b>{replyRating(r.score.value)?.label ?? "待判断"}</b>
                  </button>
                ) : (
                  pending
                )}
                {r?.correction && (
                  <span
                    className="corrected-tag"
                    title={`你的说明：${r.correction}`}
                  >
                    已按你的说明重新判断
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
