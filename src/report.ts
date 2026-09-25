import type { MemoryEvent } from "../shared/memory";
import type { Message, Overview, Period, Relation } from "../shared/types";
import { replyRating } from "../shared/ratings";
import { momentList } from "./Moments";
import { messages as currentText, periodName } from "./i18n";
import type { Messages } from "./locales/zh";

const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

function trendSvg(t: Messages, periods: Period[]) {
  const pts = periods.filter((p) => p.value != null);
  if (pts.length < 2) return "";
  const W = 600,
    H = 180,
    L = 30,
    R = 12,
    T = 12,
    B = 26;
  const x = (i: number) => L + (i / (periods.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / 100) * (H - T - B);
  const line = periods
    .map((p, i) =>
      p.value == null ? null : `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`,
    )
    .filter(Boolean)
    .join(" ");
  const grid = [0, 50, 100]
    .map(
      (v) =>
        `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#eee"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="#999">${v}</text>`,
    )
    .join("");
  const dots = periods
    .map((p, i) =>
      p.value == null
        ? ""
        : `<circle cx="${x(i)}" cy="${y(p.value)}" r="4" fill="#cf657d" stroke="#fff" stroke-width="2"/>`,
    )
    .join("");
  const labels = periods
    .map(
      (p, i) =>
        `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="#999">${esc(periodName(t, p.label, true))}</text>`,
    )
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(t.report.trendAria)}">${grid}<polyline points="${line}" fill="none" stroke="#cf657d" stroke-width="2"/>${dots}${labels}</svg>`;
}

export function buildReport(input: {
  other: string;
  self: string;
  relation: Relation;
  messages: Message[];
  overview: Overview | null;
  periods: Period[];
  events: Record<string, MemoryEvent>;
  quality: number | null;
}) {
  // Built in the language the page is showing when the report is exported.
  const t = currentText();
  const r = t.report;
  const { overview: ov, messages } = input;
  const find = (id: string | null) => messages.find((m) => m.id === id);
  const first = messages.find((m) => m.timestamp)?.timestamp;
  const last = [...messages].reverse().find((m) => m.timestamp)?.timestamp;
  const moments = momentList(input.events, messages);
  const rating = replyRating(input.quality);
  const body = `
<header>
  <p class="eyebrow">${esc(r.eyebrow)}</p>
  <h1>${esc(r.heading(input.other))}</h1>
  <p class="meta">${esc(t.relations[input.relation])} · ${esc(r.messages(messages.length))}${first && last ? ` · ${esc(r.range(first.slice(0, 10), last.slice(0, 10)))}` : ""}</p>
</header>
${
  ov
    ? `<section class="hero">
  <div><span>${esc(r.affinity)}</span><strong>${ov.affinity.value ?? "—"}</strong><small>/100</small></div>
  <div><span>${esc(r.stage)}</span><strong class="small">${esc(t.stages[ov.stage] ?? "—")}</strong></div>
  <div><span>${esc(r.performance)}</span><strong class="small">${esc(rating?.label ?? "—")}</strong>${input.quality != null ? `<small>${esc(r.points(input.quality))}</small>` : ""}</div>
</section>
${ov.reading ? `<section><h2>${esc(r.reading)}</h2><p>${esc(ov.reading)}</p></section>` : ""}
<section><h2>${esc(r.dimensions)}</h2><table>${(ov.affinityDimensions ?? [])
        .map(
          (d) =>
            `<tr><th>${esc(t.dimensions[d.key as keyof Messages["dimensions"]] ?? d.label)}</th><td class="num">${d.judgment.value ?? "—"}</td><td>${esc(d.judgment.reason ?? "")}</td></tr>`,
        )
        .join("")}</table></section>
<section><h2>${esc(r.next)}</h2><p><strong>${esc(t.actions[ov.action]?.label ?? "")}</strong>${esc(t.colon)}${esc(t.actions[ov.action]?.detail ?? "")}</p>${ov.actionReason ? `<p class="reason">${esc(ov.actionReason)}</p>` : ""}</section>`
    : `<p>${esc(r.notDone)}</p>`
}
${
  input.periods.length >= 2
    ? `<section><h2>${esc(r.trend)}</h2>${trendSvg(t, input.periods)}<table>${input.periods
        .map(
          (p) =>
            `<tr><th>${esc(periodName(t, p.label))}</th><td class="num">${p.value ?? "—"}</td><td>${esc(p.reading ?? "")}</td></tr>`,
        )
        .join("")}</table></section>`
    : ""
}
${
  moments.length
    ? `<section><h2>${esc(r.moments)}</h2><ol class="moments">${moments
        .map(
          ({ event, message }) =>
            `<li><span class="tag">${esc(t.moments[event.kind])}</span> <span class="who">${esc(message.sender === "self" ? input.self || t.me : input.other)}${message.timestamp ? ` · ${esc(message.timestamp)}` : ""}</span><blockquote>${esc(message.text)}</blockquote></li>`,
        )
        .join("")}</ol></section>`
    : ""
}
${ov?.evidenceId && find(ov.evidenceId) ? `<section><h2>${esc(r.keyLine)}</h2><blockquote>${esc(find(ov.evidenceId)!.text)}</blockquote></section>` : ""}
<footer>${esc(r.footer(new Date().toLocaleString(t.lang)))}</footer>`;
  return `<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(r.title(input.other))}</title><style>
body{margin:0;background:#f5f5f5;color:#222;font:15px/1.7 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
main{max-width:720px;margin:0 auto;padding:32px 16px 48px}
header h1{margin:4px 0;font-size:26px}.eyebrow{margin:0;color:#cf657d;font-size:13px}.meta{margin:0;color:#888;font-size:13px}
section{background:#fff;border-radius:8px;padding:18px 20px;margin-top:16px}h2{margin:0 0 10px;font-size:16px}
.hero{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.hero div{display:flex;flex-direction:column}.hero span{color:#888;font-size:12px}
.hero strong{font-size:36px;color:#cf657d;line-height:1.2}.hero strong.small{font-size:20px;color:#222;margin-top:8px}.hero small{color:#888}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:8px 6px;border-top:1px solid #f0f0f0;text-align:left;vertical-align:top}th{white-space:nowrap;font-weight:600;width:90px}
td.num{width:40px;font-variant-numeric:tabular-nums;color:#cf657d;font-weight:600}
.reason{padding:8px 12px;border-left:3px solid #cf657d;background:#fbf5f6;margin:8px 0 0}
blockquote{margin:6px 0 0;padding:8px 12px;background:#f5f5f5;border-radius:5px;white-space:pre-wrap}
.moments{padding-left:18px}.moments li{margin-bottom:12px}.tag{color:#cf657d;font-weight:600}.who{color:#888;font-size:12px}
footer{margin-top:20px;color:#999;font-size:12px;text-align:center}
@media (max-width:520px){.hero{grid-template-columns:1fr 1fr}}
</style></head><body><main>${body}</main></body></html>`;
}

export function downloadReport(html: string, other: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${currentText().report.file}-${other.replace(/[\\/:*?"<>|]/g, "")}-${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
