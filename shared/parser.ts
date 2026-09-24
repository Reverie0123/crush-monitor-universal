import { MAX_MESSAGES, MAX_TEXT_CHARS } from "./limits";
import type { Message, Parsed } from "./types";
const time =
  "(?:\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}\\s+)?\\d{1,2}:\\d{2}(?::\\d{2})?";
const header = new RegExp(`^(.{1,40}?)\\s+(${time})$`);
const bracket = new RegExp(`^\\[(${time})\\]\\s*(.{1,40}?)[：:]\\s*(.*)$`);
// Keep dates as copied: 09/10 may mean September 10 or October 9.
const qq =
  /^(.{1,80}?)[：:]\s*((?:\d{4}[-/])?\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?)$/;
const exportTime =
  "\\d{1,4}[-/.]\\d{1,2}[-/.]\\d{1,4},?\\s+\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s*[AP]M)?";
const whatsappBracket = new RegExp(`^\\[(${exportTime})\\]\\s*(.*)$`, "i");
const whatsappDash = new RegExp(`^(${exportTime})\\s+-\\s+(.*)$`, "i");
const namedText = /^([^：:<>]{1,80}?)[：:]\s*(.*)$/;
const cleanHeader = (line: string) =>
  line.replace(/^[\uFEFF\u200e\u200f]+/, "").trim();
const media =
  /^\[(?:图片|表情|语音|语音消息|视频|动画表情|表情包|文件|链接|位置|名片|红包|转账|语音通话|视频通话|聊天记录|小程序|音乐|不支持的消息|撤回消息)\]$|^<?(?:media omitted|image omitted|video omitted|audio omitted|sticker omitted)>?$/i;
// Export tools prepend a summary block (会话名称：… 导出时间：…). Its "key：value"
// lines would otherwise be read as extra speakers.
function stripExportHeader(text: string) {
  const lines = text.replace(/^﻿/, "").split("\n");
  if (
    !/^\s*【[^】]{0,20}(记录|摘要|导出)[^】]{0,20}】\s*$/.test(lines[0] ?? "")
  )
    return lines.join("\n");
  // Drop only the title and the "key：value" summary lines under it, so a
  // header without a blank line after it can't swallow the first messages.
  let i = 1;
  while (
    i < lines.length &&
    i <= 20 &&
    /^[^\s：:]{1,10}[：:].{0,120}$/.test(lines[i])
  )
    i++;
  // The block ends at the first blank line; stop there.
  while (i < lines.length && /^\s*$/.test(lines[i])) i++;
  return lines.slice(i).join("\n");
}
export function parseChat(raw: string): {
  messages: Parsed[];
  warnings: string[];
} {
  const lines = stripExportHeader(raw.replace(/\r\n?/g, "\n")).split("\n");
  const messages: Parsed[] = [];
  const warnings: string[] = [];
  const nativeFormat = lines.some((l) =>
    /^\d{4}年\d{1,2}月\d{1,2}日\s+\d{1,2}:\d{2}/.test(l.trim()),
  );
  const structured =
    nativeFormat ||
    lines.some((line) => {
      const value = cleanHeader(line);
      return (
        qq.test(value) ||
        bracket.test(value) ||
        header.test(value) ||
        whatsappBracket.test(value) ||
        whatsappDash.test(value)
      );
    });
  // `line` remembers a "name time" header so it can be given back if it
  // turns out to be a body line (e.g. 「明天 10:30」 on its own line).
  let current: (Parsed & { line?: string }) | undefined;
  const push = () => {
    if (current?.text.trim())
      messages.push({
        speaker: current.speaker,
        timestamp: current.timestamp,
        text: current.text.trim(),
      });
    else if (current?.line && messages.length)
      // A header with no message under it was really part of the previous body.
      messages[messages.length - 1].text += `\n${current.line}`;
    current = undefined;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1]?.trim();
    if (
      line.trim() &&
      next &&
      /^\d{4}年\d{1,2}月\d{1,2}日\s+\d{1,2}:\d{2}(?::\d{2})?$/.test(next)
    ) {
      push();
      current = { speaker: line.trim(), timestamp: next, text: "" };
      i++;
      continue;
    }
    if (!line.trim()) {
      if (current) current.text += "\n";
      continue;
    }
    const value = cleanHeader(line);
    const q = value.match(qq);
    const w = value.match(whatsappBracket) || value.match(whatsappDash);
    if (!nativeFormat && q) {
      push();
      current = { speaker: q[1].trim(), timestamp: q[2], text: "" };
      continue;
    }
    if (!nativeFormat && w) {
      push();
      const body = w[2].match(namedText);
      if (body) {
        current = { speaker: body[1].trim(), timestamp: w[1], text: body[2] };
      } else {
        warnings.push("已跳过没有发送人的系统通知。");
      }
      continue;
    }
    const b = value.match(bracket);
    const h = value.match(header);
    const inline = value.match(namedText);
    if (!nativeFormat && b) {
      push();
      current = { speaker: b[2], timestamp: b[1], text: b[3] };
      continue;
    }
    if (!nativeFormat && h) {
      push();
      current = { speaker: h[1], timestamp: h[2], text: "", line: value };
      continue;
    }
    if (
      !structured &&
      inline &&
      !/^https?$/.test(inline[1]) &&
      !/^\d+$/.test(inline[1])
    ) {
      push();
      current = { speaker: inline[1].trim(), timestamp: null, text: inline[2] };
      continue;
    }
    if (current) {
      current.text += (current.text ? "\n" : "") + line;
    } else {
      current = { speaker: "未分配", timestamp: null, text: line };
      warnings.push("有文本未识别出说话人，请校正。");
    }
  }
  push();
  const speakers = new Set(messages.map((m) => m.speaker));
  if (speakers.size > 2)
    warnings.push("识别到两人以上或正文中的冒号，请校正消息边界和角色。");
  if (!messages.length) warnings.push("还没有可以读取的聊天文本。");
  return { messages, warnings: [...new Set(warnings)] };
}
export function toMessages(parsed: Parsed[], self: string): Message[] {
  return parsed.map((m) => ({
    id: crypto.randomUUID(),
    timestamp: m.timestamp,
    ...classify(m.text, m.speaker === self ? "self" : "other"),
  }));
}
// WeChat system notices. Exporters often file them under the wrong speaker, so
// who acted is read from the notice itself. Names are quoted in exports, which
// keeps ordinary sentences like 「你怎么撤回了一条消息」 from matching.
const recall = /^(你|"[^"]{1,40}"|「[^」]{1,40}」)\s*撤回了一条消息\d{0,2}$/;
const pat =
  /^(我|你|"[^"]{1,40}")\s*拍了拍\s*(我|你|自己|"[^"]{1,40}")(?:的[^\n]{1,20})?$/;
function classify(
  text: string,
  sender: Message["sender"],
): Pick<Message, "text" | "sender" | "kind"> {
  const t = text.trim();
  const r = t.match(recall);
  if (r)
    return r[1] === "你"
      ? { sender: "self", kind: "system", text: "你撤回了一条消息" }
      : { sender: "other", kind: "system", text: "对方撤回了一条消息" };
  const p = t.match(pat);
  if (p)
    return {
      sender: p[1] === "我" || p[1] === "你" ? "self" : "other",
      kind: "system",
      text: t,
    };
  return { text, sender, kind: media.test(t) ? "unreadable" : "text" };
}
export function withKind(m: Message): Message {
  if (m.kind === "system") return m;
  const c = classify(m.text, m.sender);
  return c.kind === m.kind && c.sender === m.sender && c.text === m.text
    ? m
    : { ...m, ...c };
}
function equal(a: Message, b: Message) {
  return (
    a.sender === b.sender &&
    a.text === b.text &&
    (!a.timestamp || !b.timestamp || a.timestamp === b.timestamp)
  );
}
export type Merge = {
  messages: Message[];
  added: number;
  overlap: number;
  ambiguous: boolean;
  duplicate: boolean;
};
export function mergeMessages(
  old: Message[],
  incoming: Message[],
  mode: "auto" | "append" | "skip" = "auto",
): Merge {
  if (mode === "append")
    return {
      messages: [...old, ...incoming],
      added: incoming.length,
      overlap: 0,
      ambiguous: false,
      duplicate: false,
    };
  if (!old.length)
    return {
      messages: incoming,
      added: incoming.length,
      overlap: 0,
      ambiguous: false,
      duplicate: false,
    };
  // An exact batch is not ambiguous: explicitly repeated import.
  if (
    old.length === incoming.length &&
    old.every((m, i) => equal(m, incoming[i]))
  )
    return {
      messages: old,
      added: 0,
      overlap: incoming.length,
      ambiguous: false,
      duplicate: true,
    };
  let overlap = 0;
  for (let n = Math.min(old.length, incoming.length); n > 0; n--) {
    let matched = true;
    for (let i = 0; i < n; i++)
      if (!equal(old[old.length - n + i], incoming[i])) {
        matched = false;
        break;
      }
    if (matched) {
      overlap = n;
      break;
    }
  }
  const contained =
    incoming.length > 1 &&
    old.some(
      (_, i) =>
        i + incoming.length <= old.length &&
        incoming.every((m, j) => equal(old[i + j], m)),
    );
  if (contained)
    return {
      messages: old,
      added: 0,
      overlap: incoming.length,
      ambiguous: false,
      duplicate: true,
    };
  const interior =
    overlap === 0 && incoming.some((m) => old.some((o) => equal(o, m)));
  const matches =
    overlap > 0
      ? old.filter(
          (_, i) =>
            i + overlap <= old.length &&
            incoming.slice(0, overlap).every((m, j) => equal(old[i + j], m)),
        ).length
      : 0;
  const stamp = (s: string | null) =>
    s && /^\d{4}/.test(s)
      ? Date.parse(
          s
            .replace("年", "-")
            .replace("月", "-")
            .replace("日", "")
            .replace(" ", "T"),
        )
      : NaN;
  const firstNew = incoming[overlap];
  const backwards =
    firstNew && stamp(firstNew.timestamp) < stamp(old.at(-1)!.timestamp);
  const ambiguous =
    mode === "auto" &&
    ((overlap === 1 && !incoming[0].timestamp) ||
      interior ||
      matches > 1 ||
      Boolean(backwards));
  return {
    messages: [...old, ...incoming.slice(overlap)],
    added: incoming.length - overlap,
    overlap,
    ambiguous,
    duplicate: false,
  };
}
export function withinScope(messages: Message[]) {
  return (
    messages.length <= MAX_MESSAGES &&
    Array.from(messages.map((m) => m.text).join("")).length <= MAX_TEXT_CHARS
  );
}
export function recentScope(messages: Message[]) {
  const result: Message[] = [];
  let chars = 0;
  for (const m of [...messages].reverse()) {
    const len = Array.from(m.text).length;
    if (result.length === MAX_MESSAGES || chars + len > MAX_TEXT_CHARS) break;
    result.unshift(m);
    chars += len;
  }
  return result;
}
