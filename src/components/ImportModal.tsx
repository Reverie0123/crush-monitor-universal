import { Modal } from "./ui";
import { parseChat } from "../../shared/parser";
import type { Parsed } from "../../shared/types";

/** Pick which speaker is you before a pasted chat is imported. */
export function ImportModal({
  raw,
  setRaw,
  parsed,
  setParsed,
  role,
  setRole,
  onConfirm,
  close,
}: {
  raw: string;
  setRaw: (v: string) => void;
  parsed: Parsed[];
  setParsed: (p: Parsed[]) => void;
  role: string;
  setRole: (r: string) => void;
  onConfirm: () => void;
  close: () => void;
}) {
  const names = [...new Set(parsed.map((x) => x.speaker))];
  const invalid = names.length > 2 || names.includes("未分配");
  return (
    <Modal title="确认聊天里的你" close={close}>
      <div className="role-options">
        {names
          .filter((n) => n !== "未分配")
          .map((n) => (
            <button
              className={role === n ? "selected" : ""}
              key={n}
              onClick={() => setRole(n)}
            >
              {n}
            </button>
          ))}
        {names.length === 1 && (
          <button
            className={role === "__self_absent__" ? "selected" : ""}
            onClick={() => setRole("__self_absent__")}
          >
            这些都是对方的话
          </button>
        )}
      </div>
      <label className="field">
        识别到 {parsed.length} 条聊天
        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setParsed(parseChat(e.target.value).messages);
          }}
        />
      </label>
      {invalid && (
        <p className="error">
          请保留两个人的聊天，可改成「我：内容」「对方：内容」。
        </p>
      )}
      <button
        className="primary"
        disabled={
          !role ||
          !parsed.length ||
          invalid ||
          (!names.includes(role) && role !== "__self_absent__")
        }
        onClick={onConfirm}
      >
        导入聊天
      </button>
      <p className="import-hint">
        导入后会先显示预计花费，确认后再点「开始分析」。
      </p>
    </Modal>
  );
}

export function OverlapModal({
  onSkip,
  onAppend,
  close,
}: {
  onSkip: () => void;
  onAppend: () => void;
  close: () => void;
}) {
  return (
    <Modal title="这段可能重复了" close={close}>
      <p>相同内容也可能是新消息，请选择如何合并。</p>
      <button className="primary" onClick={onSkip}>
        跳过重合部分
      </button>
      <button className="secondary" onClick={onAppend}>
        作为新消息追加
      </button>
    </Modal>
  );
}
