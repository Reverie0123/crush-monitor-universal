import { useState } from "react";
import type { MemoryEvent } from "../shared/memory";
import type { Message } from "../shared/types";

export const MOMENT_LABELS: Record<MemoryEvent["kind"], string> = {
  boundary: "拒绝 / 划清界限",
  reopen: "重新靠近",
  invitation: "邀约",
  confirmation: "确认安排",
  cancellation: "取消安排",
  care: "关心",
  preference: "说出喜好",
  disclosure: "敞开心扉",
  commitment: "表达心意",
  question: "提问",
  correction: "澄清",
  none: "",
};
// Everyday kinds are hidden by default so the list reads as the relationship's milestones.
const MINOR = new Set<MemoryEvent["kind"]>([
  "question",
  "correction",
  "preference",
]);

export function momentList(
  events: Record<string, MemoryEvent>,
  messages: Message[],
  all = false,
) {
  const index = new Map(messages.map((m, i) => [m.id, i]));
  return Object.values(events)
    .filter(
      (e) =>
        e.kind !== "none" && index.has(e.id) && (all || !MINOR.has(e.kind)),
    )
    .sort((a, b) => index.get(a.id)! - index.get(b.id)!)
    .map((e) => ({ event: e, message: messages[index.get(e.id)!] }));
}

export function Moments({
  events,
  messages,
  self,
  other,
  onJump,
}: {
  events: Record<string, MemoryEvent>;
  messages: Message[];
  self: string;
  other: string;
  onJump: (id: string) => void;
}) {
  const [all, setAll] = useState(false);
  const list = momentList(events, messages, all);
  return (
    <div className="moments">
      <label className="check">
        <input
          type="checkbox"
          checked={all}
          onChange={(e) => setAll(e.target.checked)}
        />
        也显示提问、澄清、说出喜好这类日常事件
      </label>
      {!list.length ? (
        <p>
          还没有识别到关键时刻。逐句分析完成后，邀约、关心、表达心意等事件会出现在这里。
        </p>
      ) : (
        <ol className="moment-list">
          {list.map(({ event, message }) => (
            <li key={event.id} className={`moment moment-${event.kind}`}>
              <div className="moment-head">
                <span className="moment-kind">{MOMENT_LABELS[event.kind]}</span>
                <span className="moment-meta">
                  {message.sender === "self" ? self || "我" : other}
                  {message.timestamp &&
                    ` · ${message.timestamp.replace(/:\d{2}$/, "")}`}
                  {event.status === "resolved" && " · 已回应"}
                </span>
              </div>
              <button className="quote-jump" onClick={() => onJump(event.id)}>
                「{message.text.slice(0, 60)}」
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
