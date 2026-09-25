import {
  FileDown,
  Flag,
  Heart,
  MoreHorizontal,
  Plus,
  Search,
  TrendingUp,
} from "lucide-react";
import { useLang } from "../i18n";

export function ChatHeader({
  title,
  subtitle,
  value,
  delta,
  hasChat,
  hasOverview,
  on,
}: {
  title: string;
  subtitle: string;
  value: number | null | undefined;
  delta: number | null;
  hasChat: boolean;
  hasOverview: boolean;
  on: {
    overview: () => void;
    search: () => void;
    trend: () => void;
    moments: () => void;
    report: () => void;
    clear: () => void;
    settings: () => void;
  };
}) {
  const { t, lang, setLang } = useLang();
  return (
    <header className="chat-head">
      <div className="contact-title">
        <h2>{title}</h2>
        <span>{subtitle}</span>
      </div>
      <button
        className="header-affinity"
        onClick={on.overview}
        aria-label={t.header.viewAffinity}
      >
        <span>{t.header.affinity}</span>
        <strong key={value} className="affinity-number">
          {value ?? "—"}
        </strong>
        {value != null && (
          <span className="affinity-hearts" aria-hidden="true">
            <Heart className="affinity-heart heart-one" size={12} />
            <Heart className="affinity-heart heart-two" size={9} />
            <Heart className="affinity-heart heart-three" size={7} />
          </span>
        )}
        {delta != null && delta !== 0 && (
          <small>
            {delta > 0 ? "+" : ""}
            {delta}
          </small>
        )}
      </button>
      <div className="header-tools">
        {(
          [
            [t.header.search, Search, on.search, !hasChat],
            [t.header.trend, TrendingUp, on.trend, !hasChat],
            [t.header.moments, Flag, on.moments, !hasChat],
            [t.header.report, FileDown, on.report, !hasOverview],
            [t.header.newChat, Plus, on.clear, false],
          ] as const
        ).map(([label, Icon, onClick, disabled]) => (
          <button
            key={label}
            className="icon"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onClick}
          >
            <Icon size={19} />
          </button>
        ))}
        <button
          className="icon lang-toggle"
          aria-label={t.switchLabel}
          title={t.switchLabel}
          onClick={() => setLang(lang === "zh" ? "en" : "zh")}
          lang={lang === "zh" ? "en" : "zh"}
        >
          {t.switchTo}
        </button>
        <button
          className="icon"
          aria-label={t.header.more}
          onClick={on.settings}
        >
          <MoreHorizontal size={24} />
        </button>
      </div>
    </header>
  );
}
