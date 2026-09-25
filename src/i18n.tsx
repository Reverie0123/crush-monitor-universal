// Two-language interface text without a library: pick a dictionary, share it
// through context, and remember the choice in this browser.
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { zh, type Messages } from "./locales/zh";
import { en } from "./locales/en";
import type { Judgment } from "../shared/types";

export type Lang = "zh" | "en";
const DICTIONARIES: Record<Lang, Messages> = { zh, en };
const KEY = "crush-monitor-lang";

/** The saved choice, or the browser's language on first visit. */
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    // Storage blocked: fall back to the browser language.
  }
  // The first of the browser's preferred languages that we have.
  for (const l of navigator.languages ?? [navigator.language]) {
    const code = l?.toLowerCase() ?? "";
    if (code.startsWith("zh")) return "zh";
    if (code.startsWith("en")) return "en";
  }
  return "en";
}

// For code outside React (reports, API error text) that needs the current text.
let current: Lang = typeof navigator === "undefined" ? "zh" : initialLang();
export const messages = (): Messages => DICTIONARIES[current];
/** The interface language, sent with requests so the model answers in it. */
export const currentLang = (): Lang => current;

// Set before the first render, so the page never shows the wrong language tag.
if (typeof document !== "undefined") {
  document.documentElement.lang = DICTIONARIES[current].lang;
  document.title = DICTIONARIES[current].appTitle;
}

const I18n = createContext<{
  lang: Lang;
  t: Messages;
  setLang: (l: Lang) => void;
}>({
  lang: current,
  t: DICTIONARIES[current],
  setLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current);
  const t = DICTIONARIES[lang];
  useEffect(() => {
    document.documentElement.lang = t.lang;
    document.title = t.appTitle;
  }, [t]);
  const setLang = (l: Lang) => {
    current = l;
    try {
      localStorage.setItem(KEY, l);
    } catch {
      // Not remembering the choice is harmless.
    }
    setLangState(l);
  };
  return <I18n.Provider value={{ lang, t, setLang }}>{children}</I18n.Provider>;
}

/** How settled a judgment is, in the current language. */
export const judgmentText = (t: Messages, j?: Judgment) =>
  !j || j.status === "insufficient"
    ? t.judgment.insufficient
    : j.status === "clear"
      ? t.judgment.clear
      : t.judgment.ambiguous;

/**
 * Trend periods are saved with Chinese names ("8/31 那周", "第2段"); show
 * them in the current language.
 */
export function periodName(t: Messages, label: string, short = false) {
  const week = /^(.+) 那周$/.exec(label);
  if (week) return short ? t.weekShort(week[1]) : t.week(week[1]);
  const part = /^第(.+)段$/.exec(label);
  return part ? t.part(part[1]) : label;
}

/**
 * System notices (recalls, nudges) are saved in Chinese as the exports write
 * them; show them in the current language.
 */
export function systemText(t: Messages, text: string) {
  if (t.row.recalled && /^(你|对方)撤回了一条消息$/.test(text))
    return t.row.recalled(text.startsWith("你"));
  const pat = /^(我|你|"[^"]+")\s*拍了拍\s*(我|你|自己|"[^"]+")/.exec(text);
  if (t.row.nudged && pat) {
    const name = (s: string) =>
      s === "我" || s === "你" ? "You" : s === "自己" ? "themselves" : s;
    const who = name(pat[1]);
    return t.row.nudged(
      who,
      pat[2] === "自己" && who === "You"
        ? "yourself"
        : name(pat[2]).replace(/^You$/, "you"),
    );
  }
  return text;
}

/** The current language's text. */
export const useT = () => useContext(I18n).t;
export const useLang = () => useContext(I18n);

/**
 * Text that follows the language: kept as a function of the dictionary and
 * rendered with the current one, so notices and errors already on screen
 * change language together with everything else.
 */
export type Text = string | ((t: Messages) => string);
export const say = (t: Messages, x: Text) =>
  typeof x === "function" ? x(t) : x;

/** An error whose message is Text, so it re-renders in the current language. */
export class TextError extends Error {
  constructor(readonly text: Text) {
    super(typeof text === "string" ? text : text(messages()));
  }
}

/**
 * What to tell the user about a failure. Browser-level failures (network down,
 * timeouts, a reply that isn't JSON) become plain advice instead of raw
 * English technical messages.
 */
export function errorOf(e: unknown): Text {
  if (e instanceof TextError) return e.text;
  const err = e as Error | undefined;
  if (err?.name === "TypeError" && /fetch|network/i.test(err.message))
    return (t) => t.errors.network;
  if (err?.name === "TimeoutError" || err?.name === "SyntaxError")
    return (t) => t.errors.unfinished;
  return err?.message ?? String(e);
}

/**
 * Text for an API error: the server sends a stable code alongside its Chinese
 * message; unknown codes fall back to that message.
 */
export function errorText(
  body: { error?: string; code?: string } | null,
  fallback: (t: Messages) => string,
): Text {
  return (t) => {
    const byCode =
      body?.code && (t.errors as Record<string, unknown>)[body.code];
    return typeof byCode === "string" ? byCode : body?.error || fallback(t);
  };
}
