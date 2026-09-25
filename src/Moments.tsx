import { useState } from "react";
import type { MemoryEvent } from "../shared/memory";
import type { Message } from "../shared/types";
import { useT } from "./i18n";

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
  const t = useT();
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
        {t.momentsView.showMinor}
      </label>
      {!list.length ? (
        <p>{t.momentsView.empty}</p>
      ) : (
        <ol className="moment-list">
          {list.map(({ event, message }) => (
            <li key={event.id} className={`moment moment-${event.kind}`}>
              <div className="moment-head">
                <span className="moment-kind">{t.moments[event.kind]}</span>
                <span className="moment-meta">
                  {message.sender === "self" ? self || t.me : other}
                  {message.timestamp &&
                    ` · ${message.timestamp.replace(/:\d{2}$/, "")}`}
                  {event.status === "resolved" && t.momentsView.answered}
                </span>
              </div>
              <button className="quote-jump" onClick={() => onJump(event.id)}>
                {t.quote(message.text.slice(0, 60))}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
