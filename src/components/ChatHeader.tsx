import {
  FileDown,
  Flag,
  Heart,
  MoreHorizontal,
  Plus,
  Search,
  TrendingUp,
} from "lucide-react";

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
  return (
    <header className="chat-head">
      <div className="contact-title">
        <h2>{title}</h2>
        <span>{subtitle}</span>
      </div>
      <button
        className="header-affinity"
        onClick={on.overview}
        aria-label="查看好感度详情"
      >
        <span>好感度</span>
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
            ["搜索与筛选", Search, on.search, !hasChat],
            ["关系走势", TrendingUp, on.trend, !hasChat],
            ["关键时刻", Flag, on.moments, !hasChat],
            ["导出分析报告", FileDown, on.report, !hasOverview],
            ["新聊天", Plus, on.clear, false],
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
          className="icon"
          aria-label="更多聊天设置"
          onClick={on.settings}
        >
          <MoreHorizontal size={24} />
        </button>
      </div>
    </header>
  );
}
