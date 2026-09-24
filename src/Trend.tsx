import { useState } from "react";
import type { Message, Period } from "../shared/types";

const W = 560,
  H = 220,
  PAD = { top: 16, right: 16, bottom: 30, left: 34 };

/** A change this large between neighbouring periods is called out as a turning point. */
export const TURN = 10;

export function Trend({
  periods,
  messages,
  onJump,
}: {
  periods: Period[];
  messages: Message[];
  onJump: (id: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (periods.length < 2)
    return (
      <p>
        聊天需要跨越至少两周（或超过约 120
        条）才能画出走势，分析完成后会自动生成。
      </p>
    );
  const plotW = W - PAD.left - PAD.right,
    plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left +
    (periods.length === 1 ? plotW / 2 : (i / (periods.length - 1)) * plotW);
  const y = (v: number) => PAD.top + (1 - v / 100) * plotH;
  // Missing points break the line instead of being interpolated.
  const segments: string[] = [];
  let d = "";
  periods.forEach((p, i) => {
    if (p.value == null) {
      if (d) segments.push(d);
      d = "";
      return;
    }
    d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
  });
  if (d) segments.push(d);
  const delta = (i: number) => {
    const a = periods[i - 1]?.value,
      b = periods[i].value;
    return a != null && b != null ? b - a : null;
  };
  const text = (id: string | null) => messages.find((m) => m.id === id)?.text;
  const h = hover != null ? periods[hover] : null;
  return (
    <div className="trend">
      <div className="trend-chart">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="好感度随时间的变化"
        >
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line
                className="trend-grid"
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(v)}
                y2={y(v)}
              />
              <text
                className="trend-axis"
                x={PAD.left - 8}
                y={y(v) + 4}
                textAnchor="end"
              >
                {v}
              </text>
            </g>
          ))}
          {periods.map((p, i) =>
            i === 0 ||
            i === periods.length - 1 ||
            periods.length <= 6 ||
            i % 2 === 0 ? (
              <text
                key={p.endId}
                className="trend-axis"
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
              >
                {p.label.replace(" 那周", "")}
              </text>
            ) : null,
          )}
          {hover != null && (
            <line
              className="trend-crosshair"
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + plotH}
            />
          )}
          {segments.map((s) => (
            <path key={s} className="trend-line" d={s} />
          ))}
          {periods.map((p, i) => {
            if (p.value == null) return null;
            const dv = delta(i);
            const turn = dv != null && Math.abs(dv) >= TURN;
            return (
              <g key={p.endId}>
                <circle
                  className={`trend-dot ${turn ? "turn" : ""} ${hover === i ? "active" : ""}`}
                  cx={x(i)}
                  cy={y(p.value)}
                  r={hover === i ? 6 : 4.5}
                />
                {turn && (
                  <text
                    className="trend-delta"
                    x={x(i)}
                    y={y(p.value) - 11}
                    textAnchor="middle"
                  >
                    {dv! > 0 ? `+${dv}` : dv}
                  </text>
                )}
                {/* Hit target wider than the mark. */}
                <rect
                  x={x(i) - plotW / periods.length / 2}
                  y={PAD.top}
                  width={plotW / periods.length}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => p.evidenceId && onJump(p.evidenceId)}
                  style={{ cursor: p.evidenceId ? "pointer" : "default" }}
                />
              </g>
            );
          })}
        </svg>
        {h && hover != null && (
          <div
            className="trend-tooltip"
            style={{ left: `${(x(hover) / W) * 100}%` }}
            role="status"
          >
            <strong>{h.label}</strong>
            <span>
              好感 {h.value ?? "—"}
              {delta(hover) != null &&
                ` (${delta(hover)! >= 0 ? "+" : ""}${delta(hover)})`}{" "}
              · {h.count} 条
            </span>
          </div>
        )}
      </div>
      <ol className="trend-list">
        {periods.map((p, i) => {
          const dv = delta(i);
          return (
            <li
              key={p.endId}
              className={dv != null && Math.abs(dv) >= TURN ? "turn" : ""}
            >
              <div className="trend-list-head">
                <strong>{p.label}</strong>
                <span>
                  {p.value ?? "—"}
                  {dv != null && dv !== 0 && (
                    <small>{dv > 0 ? ` ↑${dv}` : ` ↓${-dv}`}</small>
                  )}
                </span>
              </div>
              {p.reading && <p>{p.reading}</p>}
              {p.evidenceId && text(p.evidenceId) && (
                <button
                  className="quote-jump"
                  onClick={() => onJump(p.evidenceId!)}
                >
                  「{text(p.evidenceId)!.slice(0, 40)}」 跳到这句
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
