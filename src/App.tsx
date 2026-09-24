import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  MessageCircle,
  Settings2,
} from "lucide-react";
import {
  loadAvatars,
  loadConversation,
  saveAvatars,
  saveConversation,
  type Avatars,
  type SavedConversation,
} from "./storage";
import { Avatar } from "./AvatarPicker";
import { apiFetch } from "./api";
import { Trend } from "./Trend";
import { Moments } from "./Moments";
import { buildReport, downloadReport } from "./report";
import { useAnalysis } from "./useAnalysis";
import { useSpend } from "./useSpend";
import { Modal } from "./components/ui";
import { DISCLAIMER_KEY, DisclaimerModal } from "./components/Disclaimer";
import { ChatHeader } from "./components/ChatHeader";
import { MessageRow } from "./components/MessageRow";
import { StatusBar } from "./components/StatusBar";
import { Composer } from "./components/Composer";
import { LineDetail } from "./components/LineDetail";
import { OverviewDetail, type OverviewKind } from "./components/OverviewDetail";
import { SettingsModal } from "./components/SettingsModal";
import { SpendModal } from "./components/SpendModal";
import { ImportModal, OverlapModal } from "./components/ImportModal";
import { SearchModal } from "./components/SearchModal";
import { replyRating } from "../shared/ratings";
import {
  CHAT_LIMITS,
  JEV_LIMITS,
  MAX_TEXT_CHARS,
  setRequestLimits,
} from "../shared/limits";
import type { PublicConfig } from "./ModelSettings";
import {
  mergeMessages,
  parseChat,
  toMessages,
  withKind,
} from "../shared/parser";
import { exampleText } from "../shared/fixtures";
import {
  ACTIONS,
  RELATIONS,
  RUBRIC,
  meanQuality,
  type Message,
  type Parsed,
  type Relation,
} from "../shared/types";

const OVERVIEW_KINDS = ["overview", "action", "performance"];
// Views opened by name; any other `detail` value is a message id.
const VIEWS = [
  ...OVERVIEW_KINDS,
  "trend",
  "moments",
  "search",
  "disclaimer",
  "spend",
  "clear",
];

export default function App() {
  const a = useAnalysis();
  const spend = useSpend(a);
  const [messages, setMessages] = useState<Message[]>([]),
    [input, setInput] = useState(""),
    [self, setSelf] = useState(""),
    [other, setOther] = useState("Crush"),
    [relation, setRelation] = useState<Relation>("crush");
  const [raw, setRaw] = useState(""),
    [parsed, setParsed] = useState<Parsed[]>([]),
    [role, setRole] = useState(""),
    [importing, setImporting] = useState(false),
    [settings, setSettings] = useState(false),
    [detail, setDetail] = useState<string | null>(null),
    [notice, setNotice] = useState("");
  const [overlap, setOverlap] = useState<Message[] | null>(null);
  const [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState("");
  const [note, setNote] = useState(""),
    [noteDraft, setNoteDraft] = useState(""),
    [configured, setConfigured] = useState(true),
    // Null until the settings load: plans depend on the model's request limits.
    [provider, setProvider] = useState<PublicConfig["provider"] | null>(null),
    // Why reply suggestions are unavailable; empty when they are available.
    [noSuggest, setNoSuggest] = useState(""),
    [highlight, setHighlight] = useState<string | null>(null),
    [suggesting, setSuggesting] = useState<string | null>(null),
    [suggestError, setSuggestError] = useState<{
      id: string;
      message: string;
    } | null>(null);

  function applyConfig(c: PublicConfig) {
    // Set before the state change so the re-render plans with the new limits.
    setRequestLimits(c.provider === "jev" ? JEV_LIMITS : CHAT_LIMITS);
    // Each model has its own prices.
    spend.reloadPrices();
    setProvider(c.provider);
    setConfigured(!!c.configured);
    setNoSuggest(
      c.suggest
        ? ""
        : c.provider === "jev" && !c.jevSuggest
          ? "当前是「仅 Jev」模式，没有回复建议；可在设置里改成「Jev + DeepSeek / OpenAI」。"
          : "写回复建议需要 DeepSeek / OpenAI 的 API Key，请在设置里填写。",
    );
  }
  useEffect(() => {
    apiFetch("/api/config")
      .then((r) => r.json())
      .then(applyConfig)
      // Without the server nothing can run anyway; plan with the defaults.
      .catch(() => setProvider("openai"));
  }, []);

  // The disclaimer must be acknowledged once per browser before any analysis.
  const [accepted, setAccepted] = useState(() => {
    try {
      return localStorage.getItem(DISCLAIMER_KEY) === "yes";
    } catch {
      return false;
    }
  });
  function accept() {
    setAccepted(true);
    try {
      localStorage.setItem(DISCLAIMER_KEY, "yes");
    } catch {
      // Asked again next visit; that is acceptable.
    }
  }
  useEffect(() => {
    if (!accepted) setDetail("disclaimer");
  }, []);

  const [avatars, setAvatars] = useState<Avatars>({});
  useEffect(() => {
    loadAvatars()
      .then(setAvatars)
      .catch(() => {});
  }, []);
  // Functional update: two quick changes must not overwrite each other.
  function updateAvatars(change: (old: Avatars) => Avatars) {
    setAvatars((old) => {
      const next = change(old);
      saveAvatars(next).catch(() =>
        setStorageError("头像保存失败，可能存储空间不足。"),
      );
      return next;
    });
  }

  const scroller = useRef<HTMLDivElement>(null);
  const virtual = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => 150,
    getItemKey: useCallback((i: number) => messages[i].id, [messages]),
    overscan: 8,
    // Chats are read from the top, like scrolling back through history.
    anchorTo: "start",
    followOnAppend: false,
    scrollEndThreshold: 100,
  });

  useEffect(() => {
    let live = true;
    loadConversation()
      .then((stored) => {
        if (!live) return;
        // Placeholders added to the parser later (e.g. [表情]) apply to saved chats too.
        const saved = stored && {
          ...stored,
          messages: stored.messages.map(withKind),
        };
        if (saved?.schema === 1) {
          setMessages(saved.messages);
          setSelf(saved.self);
          setOther(saved.other);
          setRelation(saved.relation);
          setNote(saved.note ?? "");
          setNoteDraft(saved.note ?? "");
          a.restore(saved);
        }
        setReady(true);
      })
      .catch(() => {
        if (live) {
          setStorageError(
            "本机记录读取失败，请检查浏览器存储权限。为避免覆盖旧记录，暂不自动保存。",
          );
          setReady(true);
        }
      });
    return () => {
      live = false;
    };
  }, []);

  const pendingSave = useRef<SavedConversation | null>(null),
    saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    lastSavedMessages = useRef<Message[] | null>(null);
  const flushSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    void saveConversation(pendingSave.current).catch(() =>
      setStorageError(
        "本机保存失败，可能存储空间不足。当前页面仍可使用，请勿刷新以免丢失未保存记录。",
      ),
    );
  };
  useEffect(() => {
    if (!ready || storageError) return;
    pendingSave.current = messages.length
      ? {
          schema: 1,
          // Results from older rules keep an old tag so they stay marked as old.
          rubric: a.stale ? "stale" : RUBRIC,
          messages,
          self,
          other,
          relation,
          lines: a.lines,
          events: a.events,
          overview: a.overview,
          trend: a.trend,
          analyzedCount: a.analyzedCount,
          completed: a.status === "complete",
          note,
          usage: a.usage,
          periods: a.periods,
          scope: a.scope,
          corrections: a.corrections,
          analyzedWith: a.analyzedWith(),
        }
      : null;
    if (lastSavedMessages.current !== messages || a.status !== "loading") {
      lastSavedMessages.current = messages;
      flushSave();
    } else if (!saveTimer.current)
      saveTimer.current = setTimeout(flushSave, 750);
  }, [
    ready,
    messages,
    self,
    other,
    relation,
    note,
    a.lines,
    a.events,
    a.overview,
    a.trend,
    a.analyzedCount,
    a.status,
    a.usage,
    a.periods,
    a.scope,
    a.corrections,
    a.stale,
  ]);
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) flushSave();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const stay = useRef(false);
  // Where to scroll once the next message list renders: the top on first
  // import or page load, the first new message when appending.
  const scrollTarget = useRef<number | null>(0);
  useEffect(() => {
    if (!messages.length) return;
    if (scrollTarget.current !== null) {
      const i = Math.min(scrollTarget.current, messages.length - 1);
      scrollTarget.current = null;
      stay.current = false;
      requestAnimationFrame(() => virtual.scrollToIndex(i, { align: "start" }));
    } else if (stay.current)
      virtual.scrollToIndex(messages.length - 1, { align: "end" });
  }, [messages]);

  const busy = a.status === "loading",
    ov = a.overview,
    quality = meanQuality(messages, a.lines);
  const last = a.trend.at(-1),
    previous = a.trend.at(-2);
  const delta =
    a.status === "complete" && last?.value != null && previous?.value != null
      ? last.value - previous.value
      : null;
  // What the next run would analyze and cost; nothing is sent to compute it.
  const pending = useMemo(
    () => (busy || !ready || !provider ? null : a.plan(messages, relation)),
    // a.plan reads refs that change together with these values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      busy,
      ready,
      messages,
      relation,
      note,
      // Jev splits long chats into more, smaller requests.
      provider,
      a.lines,
      a.status,
      a.periods,
      a.scope,
      a.stale,
      a.corrections,
    ],
  );
  const incomplete = messages
    .filter((m) => a.lines[m.id]?.incomplete)
    .map((m) => m.id);
  // Retrying is paid too, so its price is shown on the button.
  const retryCost = useMemo(
    () =>
      incomplete.length
        ? spend.estimateCost(a.retryEstimate(incomplete, messages, relation))
        : 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [incomplete.join(), messages, relation, spend.prices, provider],
  );

  function load(ms: Message[]) {
    // Fresh chats open at the top; appended ones at the first new message.
    const known = new Set(messages.map((m) => m.id));
    const firstNew = ms.findIndex((m) => !known.has(m.id));
    scrollTarget.current = messages.length && firstNew > 0 ? firstNew : 0;
    setMessages(ms);
    setInput("");
    // Analysis costs money: it starts only when the user clicks 开始分析.
  }
  function startAnalysis() {
    if (!accepted) {
      setDetail("disclaimer");
      return;
    }
    spend.begin(pending?.estimate ?? null);
    void a.run(messages, relation).then((started) => {
      if (!started) spend.abandon();
    });
  }
  function add(ms: Message[], mode: "auto" | "append" | "skip" = "auto") {
    const m = mergeMessages(messages, ms, mode);
    if (m.ambiguous) {
      setOverlap(ms);
      return;
    }
    if (!m.added) {
      setNotice("没有新增消息，这段已经导入过了。");
      setInput("");
      return;
    }
    setNotice("");
    load(m.messages);
  }
  function prepare(text: string) {
    if (!text.trim()) return;
    if (text.length > 250000) {
      setNotice("这次粘贴超过25万字符，请分几次追加；历史记录不会被截断。");
      return;
    }
    const p = parseChat(text);
    const names = [...new Set(p.messages.map((x) => x.speaker))];
    if (
      messages.length &&
      self &&
      !p.warnings.length &&
      names.every((n) => n === self || n === other)
    ) {
      add(toMessages(p.messages, self));
      return;
    }
    setRaw(text);
    setParsed(p.messages);
    setRole(names.includes(self) ? self : names.includes("我") ? "我" : "");
    setImporting(true);
  }
  function confirmImport() {
    const names = [...new Set(parsed.map((x) => x.speaker))];
    setSelf(role);
    setOther(names.find((n) => n !== role) || "Crush");
    setImporting(false);
    add(toMessages(parsed, role));
  }
  function clear() {
    a.reset();
    // The local reply cache holds this chat's text; clearing the chat clears it too.
    void apiFetch("/api/cache", { method: "DELETE" }).catch(() => {});
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    pendingSave.current = null;
    void saveConversation(null)
      .then(() => setStorageError(""))
      .catch(() => setStorageError("本机记录删除失败，请重试清空。"));
    setMessages([]);
    setInput("");
    setSelf("");
    setOther("Crush");
    setNote("");
    setNoteDraft("");
    a.setNote("");
    setNotice("");
    setSettings(false);
    setDetail(null);
  }
  function swap() {
    const ms = messages.map((m) => ({
      ...m,
      sender: m.sender === "self" ? ("other" as const) : ("self" as const),
    }));
    setSelf(other);
    setOther(self === "__self_absent__" ? "我" : self);
    updateAvatars((v) => ({ self: v.other, other: v.self }));
    setMessages(ms);
    a.reset(true);
    setSettings(false);
  }
  function jump(id: string) {
    const i = messages.findIndex((m) => m.id === id);
    if (i < 0) return;
    stay.current = false;
    setDetail(null);
    virtual.scrollToIndex(i, { align: "center" });
    setHighlight(id);
    setTimeout(() => setHighlight((h) => (h === id ? null : h)), 2400);
  }
  async function requestSuggestions(id: string) {
    const i = messages.findIndex((m) => m.id === id);
    if (i < 0) return;
    // The reply's lead-in, newest first until the request budget is used.
    const context: Message[] = [];
    let chars = 0;
    for (let j = i; j >= 0 && context.length < 150; j--) {
      chars += Array.from(messages[j].text).length;
      if (chars > MAX_TEXT_CHARS && context.length) break;
      context.unshift(messages[j]);
    }
    setSuggesting(id);
    setSuggestError(null);
    try {
      const r = await apiFetch("/api/suggest", {
        method: "POST",
        body: JSON.stringify({
          relation,
          note,
          targetId: id,
          messages: context,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "生成失败");
      a.annotate(id, { suggestions: body.suggestions });
      // Suggestions are paid requests too; count them in 已花费.
      if (body.usage) a.addUsage(body.usage);
    } catch (e) {
      setSuggestError({ id, message: (e as Error).message });
    } finally {
      setSuggesting(null);
    }
  }
  function saveNote() {
    const value = noteDraft.trim().slice(0, 500);
    setNote(value);
    a.setNote(value);
    setSettings(false);
  }

  const me = self && self !== "__self_absent__" ? self : "我";
  const chosen = messages.find((m) => m.id === detail);
  const closeDetail = () => setDetail(null);
  return (
    <main className="app">
      <div className="workspace">
        <section className="wechat" aria-label="微信聊天">
          <nav className="chat-rail" aria-label="聊天工具">
            <Avatar className="rail-avatar" src={avatars.self} name={me} />
            <button
              className="rail-active"
              aria-label="滚动到最新聊天"
              onClick={() => {
                stay.current = true;
                if (messages.length)
                  virtual.scrollToIndex(messages.length - 1, { align: "end" });
              }}
            >
              <MessageCircle size={23} />
            </button>
            <button
              className="rail-settings"
              aria-label="聊天设置"
              onClick={() => setSettings(true)}
            >
              <Settings2 size={22} />
            </button>
          </nav>
          <ChatHeader
            title={messages.length ? other : "微信聊天"}
            subtitle={RELATIONS[relation]}
            value={ov?.affinity.value}
            delta={delta}
            hasChat={messages.length > 0}
            hasOverview={!!ov}
            on={{
              overview: () => setDetail("overview"),
              search: () => setDetail("search"),
              trend: () => setDetail("trend"),
              moments: () => setDetail("moments"),
              report: () =>
                downloadReport(
                  buildReport({
                    other,
                    self,
                    relation,
                    messages,
                    overview: ov,
                    periods: a.periods,
                    events: a.events,
                    quality,
                  }),
                  other,
                ),
              clear: () => setDetail("clear"),
              settings: () => setSettings(true),
            }}
          />
          <div
            ref={scroller}
            className="chat-scroll"
            onScroll={(e) => {
              const el = e.currentTarget;
              stay.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 100;
            }}
          >
            {!messages.length ? (
              <div className="empty">
                <h2>粘贴聊天记录</h2>
                <p>支持微信、QQ 复制记录及 WhatsApp 文本导出</p>
                <button
                  className="text-button"
                  onClick={() => prepare(exampleText(0))}
                >
                  用一段示例试试 <ArrowUpRight size={16} />
                </button>
              </div>
            ) : (
              <div
                style={{
                  height: virtual.getTotalSize(),
                  position: "relative",
                  width: "100%",
                }}
              >
                {virtual.getVirtualItems().map((row) => {
                  const m = messages[row.index];
                  return (
                    <div
                      key={m.id}
                      data-index={row.index}
                      ref={virtual.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${row.start}px)`,
                      }}
                      id={`message-${m.id}`}
                      className={`message ${m.sender} ${highlight === m.id ? "highlight" : ""}`}
                    >
                      <MessageRow
                        m={m}
                        prev={messages[row.index - 1]}
                        r={a.lines[m.id]}
                        busy={busy || a.retrying.length > 0}
                        avatars={avatars}
                        self={self}
                        other={other}
                        onOpen={setDetail}
                        onRetry={(id) => void a.retry([id], messages, relation)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="chat-insights">
            <button
              className="reply-summary"
              onClick={() => setDetail("performance")}
            >
              <span>我的发挥</span>
              <strong>{replyRating(quality)?.label ?? "—"}</strong>
              {quality != null && <span>{quality}分</span>}
            </button>
            <span className="insight-divider" />
            <button
              className="action-summary"
              onClick={() => setDetail("action")}
            >
              <span>下一步</span>
              <strong>{ov ? ACTIONS[ov.action]?.label : "等你导入聊天"}</strong>
              <ArrowRight size={14} />
            </button>
          </div>
          <Composer
            ready={ready}
            hasChat={messages.length > 0}
            input={input}
            setInput={setInput}
            onSubmit={prepare}
            status={
              <StatusBar
                a={a}
                spend={spend}
                pending={pending}
                configured={configured}
                notice={storageError || notice}
                incomplete={incomplete}
                retryCost={retryCost}
                on={{
                  start: startAnalysis,
                  settings: () => setSettings(true),
                  spend: () => setDetail("spend"),
                  overview: () => setDetail("overview"),
                  retry: (ids) => {
                    spend.begin(a.retryEstimate(ids, messages, relation));
                    void a.retry(ids, messages, relation);
                  },
                }}
              />
            }
          />
        </section>
      </div>
      {importing && (
        <ImportModal
          raw={raw}
          setRaw={setRaw}
          parsed={parsed}
          setParsed={setParsed}
          role={role}
          setRole={setRole}
          onConfirm={confirmImport}
          close={() => setImporting(false)}
        />
      )}
      {overlap && (
        <OverlapModal
          onSkip={() => {
            add(overlap, "skip");
            setOverlap(null);
          }}
          onAppend={() => {
            add(overlap, "append");
            setOverlap(null);
          }}
          close={() => setOverlap(null)}
        />
      )}
      {settings && (
        <SettingsModal
          // Changing the model mid-run would send the rest of it to another
          // model, sized for the old one.
          analysisRunning={busy || a.retrying.length > 0 || !!a.reconsidering}
          relation={relation}
          setRelation={setRelation}
          note={note}
          noteDraft={noteDraft}
          setNoteDraft={setNoteDraft}
          saveNote={saveNote}
          messageCount={messages.length}
          self={self}
          other={other}
          avatars={avatars}
          updateAvatars={updateAvatars}
          configured={configured}
          onConfig={applyConfig}
          on={{
            swap,
            // Same confirmation as the header's 新聊天 button.
            clear: () => {
              setSettings(false);
              setDetail("clear");
            },
            disclaimer: () => {
              setSettings(false);
              setDetail("disclaimer");
            },
          }}
          close={() => {
            setSettings(false);
            spend.reloadPrices();
          }}
        />
      )}
      {detail && OVERVIEW_KINDS.includes(detail) && (
        <OverviewDetail
          kind={detail as OverviewKind}
          ov={ov}
          messages={messages}
          self={self}
          other={other}
          quality={quality}
          stale={a.stale}
          close={closeDetail}
        />
      )}
      {detail === "trend" && (
        <Modal title="关系走势" close={closeDetail}>
          <Trend periods={a.periods} messages={messages} onJump={jump} />
          <p>
            每个点是这段时间的好感信号评分，只看这段时间和一点前文。变化超过 10
            分的地方标出了涨跌，点圆点或原话可跳到聊天里对应的位置。
          </p>
        </Modal>
      )}
      {detail === "moments" && (
        <Modal title="关键时刻" close={closeDetail}>
          <Moments
            events={a.events}
            messages={messages}
            self={me}
            other={other}
            onJump={jump}
          />
        </Modal>
      )}
      {detail === "search" && (
        <SearchModal
          messages={messages}
          lines={a.lines}
          self={me}
          other={other}
          onJump={jump}
          close={closeDetail}
        />
      )}
      {detail === "disclaimer" && (
        <DisclaimerModal
          accepted={accepted}
          onAccept={() => {
            accept();
            closeDetail();
          }}
          onClose={closeDetail}
        />
      )}
      {detail === "spend" && (
        <SpendModal usage={a.usage} spend={spend} close={closeDetail} />
      )}
      {detail === "clear" && (
        <Modal title="开始新的聊天？" close={closeDetail}>
          <p>当前聊天、分析和本机保存的记录都会删除。</p>
          <button className="primary" onClick={clear}>
            开始新聊天
          </button>
          <button className="secondary" onClick={closeDetail}>
            保留当前聊天
          </button>
        </Modal>
      )}
      {detail && !VIEWS.includes(detail) && chosen && (
        <LineDetail
          // A fresh draft per message.
          key={chosen.id}
          m={chosen}
          result={a.lines[chosen.id]}
          configured={configured}
          noSuggest={noSuggest}
          suggesting={suggesting === chosen.id}
          suggestError={
            suggestError?.id === chosen.id ? suggestError.message : ""
          }
          reconsidering={a.reconsidering === chosen.id}
          savedCorrection={a.corrections[chosen.id]}
          onSuggest={() => requestSuggestions(chosen.id)}
          onReconsider={(text) =>
            a.reconsider(chosen.id, text, messages, relation)
          }
          close={closeDetail}
        />
      )}
    </main>
  );
}
