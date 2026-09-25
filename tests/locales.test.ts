import { test } from "node:test";
import assert from "node:assert/strict";
import { en } from "../src/locales/en";
import { zh } from "../src/locales/zh";
import { systemText } from "../src/i18n";
import { dateOf, withoutSeconds } from "../src/time";

/** Every string in a dictionary, calling functions with sample arguments. */
function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (typeof value === "function") {
    const args = Array.from({ length: value.length }, (_, i) => i + 2);
    const out = (value as (...a: unknown[]) => unknown)(...args);
    return typeof out === "string" ? [[path, out]] : [];
  }
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([k, v]) =>
      strings(v, path ? `${path}.${k}` : k),
    );
  return [];
}

test("English text has no Chinese left and no doubled spaces", () => {
  // The only Chinese on purpose: the button that switches back to Chinese.
  const allowed = new Set(["switchTo", "switchLabel"]);
  for (const [path, s] of strings(en)) {
    if (allowed.has(path)) continue;
    assert.doesNotMatch(s, /[一-鿿]/, path);
    assert.doesNotMatch(s, /\S {2,}\S/, path);
  }
});

test("both dictionaries have the same keys", () => {
  const keys = (d: object, path = ""): string[] =>
    Object.entries(d)
      .flatMap(([k, v]) =>
        v && typeof v === "object" && !Array.isArray(v)
          ? keys(v, `${path}${k}.`)
          : [`${path}${k}`],
      )
      .sort();
  assert.deepEqual(keys(en), keys(zh));
});

test("English counts use the singular for one", () => {
  assert.equal(en.status.pendingLines(1), "1 message to analyze");
  assert.equal(en.status.pendingLines(1200), "1,200 messages to analyze");
  assert.equal(en.report.messages(1), "1 message");
  assert.match(en.status.retryOnly(1, "$0"), /the unfinished message/);
  assert.equal(zh.status.pendingLines(1200), "待分析 1,200 条");
});

test("system notices follow the interface language", () => {
  assert.equal(systemText(en, "你撤回了一条消息"), "You recalled a message");
  assert.equal(systemText(en, "对方撤回了一条消息"), "They recalled a message");
  assert.equal(systemText(en, '"小林" 拍了拍 我'), '"小林" nudged you');
  assert.equal(systemText(en, "我拍了拍自己"), "You nudged yourself");
  assert.equal(systemText(zh, "你撤回了一条消息"), "你撤回了一条消息");
});

test("timestamps lose only their seconds", () => {
  assert.equal(withoutSeconds("2024-05-01 21:03:45"), "2024-05-01 21:03");
  assert.equal(withoutSeconds("2024-05-01 21:03"), "2024-05-01 21:03");
  assert.equal(dateOf("2024年5月1日 21:03"), "2024年5月1日");
  assert.equal(dateOf("2024-05-01 21:03:45"), "2024-05-01");
  assert.equal(dateOf("5/1/24, 9:03 PM"), "5/1/24");
});
