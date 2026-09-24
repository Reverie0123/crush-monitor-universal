// Derived signals the model reads poorly from raw text: reply timing and quoted replies.
import type { Message } from "./types";

const full =
  /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const monthDay = /^(\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const clock = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Parses the timestamp formats the chat parser keeps verbatim. Dates without a
 * year borrow `fallbackYear`; bare clock times return null because their day is unknown.
 */
export function parseTime(
  ts: string | null,
  fallbackYear?: number,
): Date | null {
  if (!ts) return null;
  const s = ts.trim();
  let m = s.match(full);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  m = s.match(monthDay);
  if (m && fallbackYear)
    return new Date(fallbackYear, +m[1] - 1, +m[2], +m[3], +m[4], +(m[5] ?? 0));
  if (clock.test(s)) return null;
  return null;
}

export function formatGap(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return "1分钟内";
  const min = Math.round(s / 60);
  if (min < 60) return `${min}分钟`;
  const h = ms / 3600000;
  if (h < 24) return `${Math.round(h * 10) / 10}小时`;
  return `${Math.round(h / 24)}天`;
}

const WEEK = "日一二三四五六";
function describeTime(d: Date) {
  const h = d.getHours();
  const part =
    h < 5
      ? "深夜"
      : h < 9
        ? "早上"
        : h < 12
          ? "上午"
          : h < 14
            ? "中午"
            : h < 18
              ? "下午"
              : h < 23
                ? "晚上"
                : "深夜";
  return `周${WEEK[d.getDay()]}${part}`;
}

export type Timing = { when?: string; gap?: string; replyTo?: string };

/**
 * For each message: the time of day, and the gap since the previous message.
 * When the sender changed, the gap is how long this person took to reply.
 */
export function timings(messages: Message[]): Timing[] {
  const year = messages
    .map((m) => parseTime(m.timestamp))
    .find((d) => d)
    ?.getFullYear();
  const times = messages.map((m) => parseTime(m.timestamp, year));
  return messages.map((m, i) => {
    const t = times[i];
    if (!t) return {};
    const prev = i > 0 ? times[i - 1] : null;
    const out: Timing = { when: describeTime(t) };
    if (prev && t >= prev) {
      const gap = formatGap(t.getTime() - prev.getTime());
      if (messages[i - 1].sender !== m.sender) out.replyTo = gap;
      else out.gap = gap;
    }
    return out;
  });
}

// WeChat exports append quoted replies as a final line: 「引用：昵称 : 原话」.
const quoteLine = /\n?引用[：:]\s*(.{1,40}?)\s*[：:]\s*([\s\S]+)$/;

export function splitQuote(text: string): { text: string; quote?: string } {
  const m = text.match(quoteLine);
  if (!m || m.index === undefined) return { text };
  const body = text.slice(0, m.index).trim();
  return body ? { text: body, quote: m[2].trim() } : { text };
}

/** Finds the earlier message a quote refers to, newest first. Quotes may be truncated. */
export function findQuoted(messages: Message[], before: number, quote: string) {
  const q = quote.replace(/[…\.]{1,3}$/, "").trim();
  if (q.length < 2) return -1;
  for (let i = before - 1; i >= Math.max(0, before - 2000); i--) {
    const t = splitQuote(messages[i].text).text;
    if (t === q || t.startsWith(q) || (q.length >= 6 && t.includes(q)))
      return i;
  }
  return -1;
}

/** Splits messages into calendar weeks, or into even chunks when there are no timestamps. */
export function periods(messages: Message[], maxPeriods = 12) {
  const year = messages
    .map((m) => parseTime(m.timestamp))
    .find((d) => d)
    ?.getFullYear();
  const times = messages.map((m) => parseTime(m.timestamp, year));
  const dated = times.filter(Boolean).length >= messages.length * 0.8;
  const groups: { label: string; start: number; end: number }[] = [];
  if (dated) {
    let key = "";
    messages.forEach((_, i) => {
      const t = times[i] ?? times.slice(0, i).reverse().find(Boolean) ?? null;
      if (!t) return;
      const monday = new Date(t);
      monday.setHours(0, 0, 0, 0);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const k = monday.toDateString();
      if (k !== key) {
        key = k;
        groups.push({
          label: `${monday.getMonth() + 1}/${monday.getDate()} 那周`,
          start: i,
          end: i,
        });
      } else groups[groups.length - 1].end = i;
    });
    // Merge very quiet weeks into the previous one so each point has enough signal.
    for (let i = groups.length - 1; i > 0; i--)
      if (groups[i].end - groups[i].start < 15) {
        groups[i - 1].end = groups[i].end;
        groups.splice(i, 1);
      }
  }
  if (!dated || groups.length < 2) {
    groups.length = 0;
    const n = Math.min(
      maxPeriods,
      Math.max(1, Math.floor(messages.length / 60)),
    );
    const size = Math.ceil(messages.length / n);
    for (let s = 0, k = 1; s < messages.length; s += size, k++)
      groups.push({
        label: `第${k}段`,
        start: s,
        end: Math.min(messages.length, s + size) - 1,
      });
  }
  return groups.slice(-maxPeriods);
}
