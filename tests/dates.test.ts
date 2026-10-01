import { test } from "node:test";
import assert from "node:assert/strict";
import { dateOrder, parseTime, periods, timings } from "../shared/context";
import { scopeFilter } from "../shared/plan";
import type { Message } from "../shared/types";

const at = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()];

test("WhatsApp and English timestamps parse, including AM/PM and two-digit years", () => {
  assert.deepEqual(at(parseTime("9/17/26, 7:26:53 PM", undefined, "mdy")!), [2026, 9, 17, 19, 26, 53]);
  assert.deepEqual(at(parseTime("9/17/26, 12:05 AM", undefined, "mdy")!), [2026, 9, 17, 0, 5, 0]);
  assert.deepEqual(at(parseTime("17/09/2026, 19:27")!), [2026, 9, 17, 19, 27, 0]);
  assert.deepEqual(at(parseTime("17.09.26, 19:26")!), [2026, 9, 17, 19, 26, 0]);
  assert.deepEqual(at(parseTime("2026/9/17, 7:26 pm")!), [2026, 9, 17, 19, 26, 0]);
  // The formats that already worked still do.
  assert.deepEqual(at(parseTime("2026-09-17 19:26:53")!), [2026, 9, 17, 19, 26, 53]);
  assert.deepEqual(at(parseTime("2026年9月17日 19:26")!), [2026, 9, 17, 19, 26, 0]);
  assert.equal(parseTime("19:26"), null);
});

test("day/month order is decided once for the whole chat", () => {
  const ts = (...list: string[]) => list.map((timestamp) => ({ timestamp }));
  assert.equal(dateOrder(ts("9/10/26, 7:26 PM", "9/17/26, 7:30 PM")), "mdy");
  assert.equal(dateOrder(ts("09/10/2026, 19:28", "17/09/2026, 19:27")), "dmy");
  // Nothing over 12: a two-digit year means a US export, a four-digit one does not.
  assert.equal(dateOrder(ts("9/10/26, 7:26 PM")), "mdy");
  assert.equal(dateOrder(ts("09/10/2026, 19:28")), "dmy");
});

/** A WhatsApp (US) chat: three weeks, 20 messages a week, cooling off in the last. */
function whatsapp(): Message[] {
  const out: Message[] = [];
  let id = 0;
  for (let week = 0; week < 3; week++)
    for (let i = 0; i < 20; i++) {
      const day = 1 + week * 7 + (i % 5);
      out.push({
        id: String(id++),
        sender: i % 2 ? "self" : "other",
        text: i % 2 ? "sure" : "hey, dinner tonight?",
        timestamp: `9/${day}/26, ${7 + (i % 3)}:${String(i).padStart(2, "0")}:00 PM`,
        kind: "text",
      } as Message);
    }
  return out;
}

test("with WhatsApp timestamps the trend is weekly and the 7-day scope really cuts", () => {
  const ms = whatsapp();
  const weeks = periods(ms);
  assert.equal(weeks.length, 3);
  assert.ok(weeks.every((p) => p.label.includes("那周")), weeks.map((p) => p.label).join());
  const keep = scopeFilter(ms, { level: "full", days: 7 });
  const kept = ms.filter(keep);
  assert.ok(kept.length < ms.length && kept.length >= 15, String(kept.length));
  // Timing signals exist too: time of day and reply gaps.
  const t = timings(ms);
  assert.ok(t[1].when && t[1].replyTo, JSON.stringify(t[1]));
});
