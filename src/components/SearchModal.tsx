import { useMemo, useState } from "react";
import { Modal } from "./ui";
import { replyRating } from "../../shared/ratings";
import type { LineResult, Message } from "../../shared/types";

const NEGATIVE = ["angry", "sad", "annoyed", "disappointed"];
type Filter = "all" | "lowReply" | "negative" | "incomplete" | "corrected";
const FILTERS: [Filter, string][] = [
  ["all", "全部"],
  ["lowReply", "我的低分回复"],
  ["negative", "对方负面情绪"],
  ["incomplete", "未完成"],
  ["corrected", "我纠正过的"],
];
const MAX_RESULTS = 200;

function matches(f: Filter, m: Message, r?: LineResult) {
  switch (f) {
    case "all":
      return true;
    case "lowReply":
      return m.sender === "self" && (r?.score.value ?? 100) < 60;
    case "negative": {
      if (m.sender !== "other" || !r?.emotions) return false;
      const top = Object.entries(r.emotions).sort((a, b) => b[1] - a[1])[0];
      return !!top && NEGATIVE.includes(top[0]) && top[1] >= 0.35;
    }
    case "incomplete":
      return !!r?.incomplete;
    case "corrected":
      return !!r?.correction;
  }
}

/** Find messages by text, or by what the analysis said about them. */
export function SearchModal({
  messages,
  lines,
  self,
  other,
  onJump,
  close,
}: {
  messages: Message[];
  lines: Record<string, LineResult>;
  self: string;
  other: string;
  onJump: (id: string) => void;
  close: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && filter === "all") return [];
    return messages.filter(
      (m) =>
        (!q || m.text.toLowerCase().includes(q)) &&
        matches(filter, m, lines[m.id]),
    );
  }, [messages, lines, query, filter]);
  return (
    <Modal title="搜索与筛选" close={close}>
      <label className="field">
        搜索聊天内容
        <input
          autoFocus
          value={query}
          placeholder="比如：周末、吃饭、生日"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="filter-row" role="group" aria-label="筛选">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            className={filter === k ? "selected" : ""}
            onClick={() => setFilter(k)}
          >
            {label}
          </button>
        ))}
      </div>
      {query.trim() || filter !== "all" ? (
        <p className="search-count">
          找到 {results.length} 条
          {results.length > MAX_RESULTS && `，只显示前 ${MAX_RESULTS} 条`}
        </p>
      ) : (
        <p className="search-count">输入关键词，或选一个筛选条件。</p>
      )}
      <ol className="search-results">
        {results.slice(0, MAX_RESULTS).map((m) => {
          const r = lines[m.id];
          const rating =
            m.sender === "self" ? replyRating(r?.score.value) : null;
          return (
            <li key={m.id}>
              <button className="quote-jump" onClick={() => onJump(m.id)}>
                <span className="search-meta">
                  {m.sender === "self" ? self || "我" : other}
                  {m.timestamp && ` · ${m.timestamp.replace(/:\d{2}$/, "")}`}
                  {rating && ` · 回复评级 ${rating.label}`}
                </span>
                <span className="search-text">{m.text.slice(0, 80)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </Modal>
  );
}
