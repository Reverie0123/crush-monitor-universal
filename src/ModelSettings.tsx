import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { DEFAULT_PRICES, loadPrices, savePrices, type Prices } from "./cost";

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
    label: "TypeSafe 官方",
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
  const [loadedPrices] = useState(() => ({
    openai: loadPrices("openai"),
    jev: loadPrices("jev"),
  }));
  const [pricesBy, setPricesBy] = useState(loadedPrices);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch("/api/config")
      .then((r) => r.json())
      .then((c: PublicConfig) => {
        setSaved(c);
        setForm(c);
      })
      .catch(() => setStatus("读取设置失败，请确认启动窗口还开着"));
  }, []);

  if (!form)
    return <p className="settings-status">{status || "正在读取设置…"}</p>;
  const set = (patch: Partial<PublicConfig>) => setForm({ ...form, ...patch });
  const jev = form.provider === "jev";
  // The chat-model fields are shown (and sent) only when that model is used.
  const usesChat = !jev || form.jevSuggest;
  const prices = pricesBy[form.provider];
  const setPrices = (p: Prices) =>
    setPricesBy((all) => ({ ...all, [form.provider]: p }));
  const platform =
    JEV_PLATFORMS.find((p) => p.key === form.jevPlatform) ?? JEV_PLATFORMS[0];

  async function save(test = false) {
    // OpenRouter keys are recognisable; catch one pasted under another platform.
    if (
      jev &&
      jevKey.trim().startsWith("sk-or-") &&
      form!.jevPlatform !== "openrouter"
    ) {
      setStatus("这看起来是 OpenRouter 的 Key，请把调用平台选成 OpenRouter");
      return;
    }
    setBusy(true);
    setStatus(test ? "正在保存并测试连接…" : "正在保存…");
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
      if (!r.ok) throw new Error(body.error || "保存失败");
      setSaved(body);
      setForm(body);
      setApiKey("");
      setJevKey("");
      // Only prices the user changed, so untouched ones keep following the
      // built-in defaults.
      for (const p of ["openai", "jev"] as const)
        if (JSON.stringify(pricesBy[p]) !== JSON.stringify(loadedPrices[p]))
          savePrices(pricesBy[p], p);
      onSaved?.(body);
      if (!test) {
        setStatus("已保存，立即生效");
        return;
      }
      const t = await (
        await apiFetch("/api/config/test", { method: "POST" })
      ).json();
      setStatus(
        t.ok
          ? `连接成功：${t.model}，用时 ${(t.latencyMs / 1000).toFixed(1)} 秒`
          : `连接失败：${t.error ?? "模型没有按要求回复"}`,
      );
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function clearCache() {
    await apiFetch("/api/cache", { method: "DELETE" });
    setStatus("已清除本地缓存的分析结果");
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
        {jev ? "回复建议用的 API Key（DeepSeek / OpenAI）" : "API Key"}
        <input
          type="password"
          autoComplete="off"
          value={apiKey}
          placeholder={
            saved?.keyHint
              ? `已设置（${saved.keyHint}），留空则不修改`
              : "粘贴你的 API Key"
          }
          onChange={(e) => setApiKey(e.target.value)}
        />
      </label>
      <label className="field">
        接口地址
        <input
          value={form.baseURL}
          onChange={(e) => set({ baseURL: e.target.value })}
        />
      </label>
      <div className="field-row">
        <label className="field">
          模型
          <input
            value={form.model}
            onChange={(e) => set({ model: e.target.value })}
          />
        </label>
        <label className="field">
          推理强度
          <select
            value={form.effort}
            onChange={(e) => set({ effort: e.target.value })}
          >
            <option value="">不设置（DeepSeek 选这个）</option>
            <option value="minimal">minimal</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>
      </div>
      <label className="field">
        随机度（temperature，留空用默认；越低结果越稳定）
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
      <div className="preset-row" role="group" aria-label="分析用的模型">
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
          Jev（原版模型）
        </button>
      </div>
      {saved && form.provider !== saved.provider && (
        <p className="settings-note">
          保存后切换。已经分析过的消息保留原来的结果，之后的新消息和整体判断用新模型。
        </p>
      )}
      {jev ? (
        <>
          <label className="field">
            Jev 调用平台
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
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <p className="settings-note">
            在{" "}
            <a href={platform.keyUrl} target="_blank" rel="noreferrer">
              {platform.label}
            </a>{" "}
            申请 Key。Jev 是原作者使用的 TypeSafe
            判断模型，给出的概率经过专门校准，但不写判断理由。一次最多读 500 条
            / 12,000
            字，更长的聊天会自动分批上传（逐句分析覆盖全部消息，整体好感只读最近的部分）。Jev
            按平台规则计费，下面的单价估算仅供参考。
          </p>
          <label className="field">
            {platform.label} API Key
            <input
              type="password"
              autoComplete="off"
              value={jevKey}
              placeholder={
                saved?.jevKeyHints[form.jevPlatform]
                  ? `已设置（${saved.jevKeyHints[form.jevPlatform]}），留空则不修改`
                  : "粘贴你的 API Key"
              }
              onChange={(e) => setJevKey(e.target.value)}
            />
          </label>
          <div className="preset-row" role="group" aria-label="回复建议">
            <button
              className={!form.jevSuggest ? "selected" : ""}
              onClick={() => set({ jevSuggest: false })}
            >
              仅 Jev
            </button>
            <button
              className={form.jevSuggest ? "selected" : ""}
              onClick={() => set({ jevSuggest: true })}
            >
              Jev + DeepSeek / OpenAI
            </button>
          </div>
          <p className="settings-note">
            {form.jevSuggest
              ? "分析用 Jev；「这句可以怎么说更好」的回复建议由下面的模型来写。"
              : "只用 Jev 分析，不提供回复建议（Jev 只会打分，不会写句子）。"}
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
        发送前自动打码手机号、邮箱、身份证号、银行卡号
      </label>
      <label className="field">
        额外打码的词（真名、学校、地址等，用逗号分隔）
        <textarea
          rows={2}
          value={form.maskWords}
          placeholder="例如：张三，XX中学，幸福小区"
          onChange={(e) => set({ maskWords: e.target.value })}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={form.cache}
          onChange={(e) => set({ cache: e.target.checked })}
        />
        缓存分析结果：同样的内容再分析时不重复花钱
      </label>
      <fieldset className="price-row">
        <legend>
          {jev ? "Jev 的单价" : "单价"}
          （元 / 百万 token，用于估算花费，请以服务商官网为准）
        </legend>
        {(["input", "cached", "output"] as const).map((k) => (
          <label key={k}>
            {{ input: "输入", cached: "缓存命中", output: "输出" }[k]}
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
          恢复默认
        </button>
      </fieldset>
      <div className="settings-actions">
        <button
          className="primary"
          disabled={busy || locked}
          onClick={() => save(true)}
        >
          保存并测试连接
        </button>
        <button
          className="secondary"
          disabled={busy || locked}
          onClick={() => save(false)}
        >
          仅保存
        </button>
        <button className="secondary" disabled={busy} onClick={clearCache}>
          清除本地缓存
        </button>
      </div>
      {locked && (
        <p className="settings-note">
          正在分析，停止或完成后才能保存模型设置。
        </p>
      )}
      {status && (
        <p className="settings-status" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
