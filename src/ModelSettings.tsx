import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { DEFAULT_PRICES, loadPrices, savePrices, type Prices } from "./cost";
import { TextError, errorOf, errorText, say, useT, type Text } from "./i18n";

export type PublicConfig = {
  provider: "openai" | "jev";
  configured: boolean;
  keyHint: string;
  jevPlatform: "typesafe" | "openrouter" | "vercel";
  jevKeyHints: Record<"typesafe" | "openrouter" | "vercel", string>;
  /** With Jev: whether the chat model also writes reply suggestions. */
  jevSuggest: boolean;
  /** Whether reply suggestions are available with the saved settings. */
  suggest: boolean;
  model: string;
  baseURL: string;
  effort: string;
  temperature: number | null;
  mask: boolean;
  maskWords: string;
  cache: boolean;
};

const PRESETS = [
  {
    label: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    effort: "",
  },
  {
    label: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    model: "gpt-5-mini",
    effort: "low",
  },
];

const JEV_PLATFORMS = [
  {
    key: "openrouter",
    label: "OpenRouter",
    keyUrl: "https://openrouter.ai/settings/keys",
  },
  {
    key: "vercel",
    label: "Vercel AI Gateway",
    keyUrl: "https://vercel.com/d?to=/%5Bteam%5D/~/ai-gateway/api-keys",
  },
  {
    key: "typesafe",
    label: "TypeSafe",
    keyUrl: "https://console.typesafe.ai/",
  },
] as const;

export function ModelSettings({
  onSaved,
  locked = false,
}: {
  onSaved?: (c: PublicConfig) => void;
  /** An analysis is running: saving would switch models under it. */
  locked?: boolean;
}) {
  const [saved, setSaved] = useState<PublicConfig | null>(null);
  const [form, setForm] = useState<PublicConfig | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [jevKey, setJevKey] = useState("");
  // Each model's price fields, kept separately so switching back and forth in
  // the form does not lose unsaved edits.
  const [pricesBy, setPricesBy] = useState(() => ({
    openai: loadPrices("openai"),
    jev: loadPrices("jev"),
  }));
  const [status, setStatusState] = useState<Text>("");
  // Wrapped so a Text function is stored, not called as a state updater.
  const setStatus = (x: Text) => setStatusState(() => x);
  const [busy, setBusy] = useState(false);
  const t = useT();

  useEffect(() => {
    apiFetch("/api/config")
      .then((r) => r.json())
      .then((c: PublicConfig) => {
        setSaved(c);
        setForm(c);
      })
      .catch(() => setStatus((t) => t.model.loadFailed));
  }, []);

  if (!form)
    return (
      <p className="settings-status">{say(t, status) || t.model.loading}</p>
    );
  const set = (patch: Partial<PublicConfig>) => setForm({ ...form, ...patch });
  const jev = form.provider === "jev";
  // The chat-model fields are shown (and sent) only when that model is used.
  const usesChat = !jev || form.jevSuggest;
  const prices = pricesBy[form.provider];
  const setPrices = (p: Prices) =>
    setPricesBy((all) => ({ ...all, [form.provider]: p }));
  const platform =
    JEV_PLATFORMS.find((p) => p.key === form.jevPlatform) ?? JEV_PLATFORMS[0];
  const platformName = (p: (typeof JEV_PLATFORMS)[number]) =>
    p.key === "typesafe" ? t.model.typesafe : p.label;

  async function save(test = false) {
    // OpenRouter keys are recognisable; catch one pasted under another platform.
    if (
      jev &&
      jevKey.trim().startsWith("sk-or-") &&
      form!.jevPlatform !== "openrouter"
    ) {
      setStatus((t) => t.model.openrouterKey);
      return;
    }
    setBusy(true);
    setStatus((t) => (test ? t.model.savingTest : t.model.saving));
    try {
      const r = await apiFetch("/api/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Only keys typed into fields that are on screen.
          ...(usesChat && apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          ...(jev && jevKey.trim() ? { jevApiKey: jevKey.trim() } : {}),
          provider: form!.provider,
          jevPlatform: form!.jevPlatform,
          jevSuggest: form!.jevSuggest,
          model: form!.model,
          baseURL: form!.baseURL,
          effort: form!.effort,
          temperature: form!.temperature,
          mask: form!.mask,
          maskWords: form!.maskWords,
          cache: form!.cache,
        }),
      });
      const body = await r.json();
      if (!r.ok)
        throw new TextError(errorText(body, (t) => t.model.saveFailed));
      setSaved(body);
      setForm(body);
      setApiKey("");
      setJevKey("");
      // Only prices the user changed, so untouched ones keep following the
      // built-in defaults.
      for (const p of ["openai", "jev"] as const)
        if (JSON.stringify(pricesBy[p]) !== JSON.stringify(loadPrices(p)))
          savePrices(pricesBy[p], p);
      onSaved?.(body);
      if (!test) {
        setStatus((t) => t.model.saved);
        return;
      }
      const result = await (
        await apiFetch("/api/config/test", { method: "POST" })
      ).json();
      const reason = errorText(result, (t) => t.model.noReply);
      setStatus((t) =>
        result.ok
          ? t.model.connected(
              result.chatModel
                ? t.model.suggestModel(result.model, result.chatModel)
                : result.model,
              (result.latencyMs / 1000).toFixed(1),
            )
          : t.model.failed(say(t, reason)),
      );
    } catch (e) {
      setStatus(errorOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function clearCache() {
    await apiFetch("/api/cache", { method: "DELETE" });
    setStatus((t) => t.model.cacheCleared);
  }

  // The chat model's settings: the analysis model in DeepSeek / OpenAI mode,
  // and the reply-suggestion model in Jev + chat mode.
  const chatFields = (
    <>
      <div className="preset-row">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className={form.baseURL === p.baseURL ? "selected" : ""}
            onClick={() =>
              set({ baseURL: p.baseURL, model: p.model, effort: p.effort })
            }
          >
            {p.label}
          </button>
        ))}
      </div>
      <label className="field">
        {jev ? t.model.suggestKey : t.model.apiKey}
        <input
          type="password"
          autoComplete="off"
          value={apiKey}
          placeholder={
            saved?.keyHint ? t.model.keySet(saved.keyHint) : t.model.pasteKey
          }
          onChange={(e) => setApiKey(e.target.value)}
        />
      </label>
      <label className="field">
        {t.model.baseURL}
        <input
          value={form.baseURL}
          onChange={(e) => set({ baseURL: e.target.value })}
        />
      </label>
      <div className="field-row">
        <label className="field">
          {t.model.modelName}
          <input
            value={form.model}
            onChange={(e) => set({ model: e.target.value })}
          />
        </label>
        <label className="field">
          {t.model.effort}
          <select
            value={form.effort}
            onChange={(e) => set({ effort: e.target.value })}
          >
            <option value="">{t.model.effortNone}</option>
            <option value="minimal">minimal</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>
      </div>
      <label className="field">
        {t.model.temperature}
        <input
          type="number"
          min={0}
          max={2}
          step={0.1}
          value={form.temperature ?? ""}
          onChange={(e) =>
            set({
              temperature:
                e.target.value === "" ? null : Number(e.target.value),
            })
          }
        />
      </label>
    </>
  );

  return (
    <div className="model-settings">
      <div
        className="preset-row"
        role="group"
        aria-label={t.model.analysisModel}
      >
        <button
          className={!jev ? "selected" : ""}
          onClick={() => set({ provider: "openai" })}
        >
          DeepSeek / OpenAI
        </button>
        <button
          className={jev ? "selected" : ""}
          onClick={() => set({ provider: "jev" })}
        >
          {t.model.jevOriginal}
        </button>
      </div>
      {saved && form.provider !== saved.provider && (
        <p className="settings-note">{t.model.switchNote}</p>
      )}
      {jev ? (
        <>
          <label className="field">
            {t.model.jevPlatform}
            <select
              value={form.jevPlatform}
              onChange={(e) => {
                set({
                  jevPlatform: e.target.value as PublicConfig["jevPlatform"],
                });
              }}
            >
              {JEV_PLATFORMS.map((p) => (
                <option value={p.key} key={p.key}>
                  {platformName(p)}
                </option>
              ))}
            </select>
          </label>
          <p className="settings-note">
            {t.model.jevNoteApply}{" "}
            <a href={platform.keyUrl} target="_blank" rel="noreferrer">
              {platformName(platform)}
            </a>
            {t.model.jevNoteRest}
          </p>
          <label className="field">
            {t.model.platformKey(platformName(platform))}
            <input
              type="password"
              autoComplete="off"
              value={jevKey}
              placeholder={
                saved?.jevKeyHints[form.jevPlatform]
                  ? t.model.keySet(saved.jevKeyHints[form.jevPlatform])
                  : t.model.pasteKey
              }
              onChange={(e) => setJevKey(e.target.value)}
            />
          </label>
          <div
            className="preset-row"
            role="group"
            aria-label={t.model.suggestions}
          >
            <button
              className={!form.jevSuggest ? "selected" : ""}
              onClick={() => set({ jevSuggest: false })}
            >
              {t.model.jevOnly}
            </button>
            <button
              className={form.jevSuggest ? "selected" : ""}
              onClick={() => set({ jevSuggest: true })}
            >
              {t.model.jevPlus}
            </button>
          </div>
          <p className="settings-note">
            {form.jevSuggest ? t.model.jevPlusNote : t.model.jevOnlyNote}
          </p>
          {form.jevSuggest && chatFields}
        </>
      ) : (
        chatFields
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={form.mask}
          onChange={(e) => set({ mask: e.target.checked })}
        />
        {t.model.mask}
      </label>
      <label className="field">
        {t.model.maskWords}
        <textarea
          rows={2}
          value={form.maskWords}
          placeholder={t.model.maskWordsPlaceholder}
          onChange={(e) => set({ maskWords: e.target.value })}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={form.cache}
          onChange={(e) => set({ cache: e.target.checked })}
        />
        {t.model.cache}
      </label>
      <fieldset className="price-row">
        <legend>
          {jev ? t.model.jevPrices : t.model.prices}
          {t.model.pricesUnit}
        </legend>
        {(["input", "cached", "output"] as const).map((k) => (
          <label key={k}>
            {t.model.priceKinds[k]}
            <input
              type="number"
              min={0}
              step={0.1}
              value={prices[k]}
              onChange={(e) =>
                setPrices({ ...prices, [k]: Number(e.target.value) || 0 })
              }
            />
          </label>
        ))}
        <button
          className="text-button"
          onClick={() => setPrices({ ...DEFAULT_PRICES })}
        >
          {t.model.resetPrices}
        </button>
      </fieldset>
      <div className="settings-actions">
        <button
          className="primary"
          disabled={busy || locked}
          onClick={() => save(true)}
        >
          {t.model.saveTest}
        </button>
        <button
          className="secondary"
          disabled={busy || locked}
          onClick={() => save(false)}
        >
          {t.model.saveOnly}
        </button>
        <button className="secondary" disabled={busy} onClick={clearCache}>
          {t.model.clearCache}
        </button>
      </div>
      {locked && <p className="settings-note">{t.model.locked}</p>}
      {status && (
        <p className="settings-status" role="status">
          {say(t, status)}
        </p>
      )}
    </div>
  );
}
