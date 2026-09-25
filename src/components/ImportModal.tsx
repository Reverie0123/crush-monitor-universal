import { Modal } from "./ui";
import { parseChat } from "../../shared/parser";
import type { Parsed } from "../../shared/types";
import { useT } from "../i18n";

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
  const t = useT();
  const names = [...new Set(parsed.map((x) => x.speaker))];
  const invalid = names.length > 2 || names.includes("未分配");
  return (
    <Modal title={t.importer.title} close={close}>
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
            {t.importer.allOther}
          </button>
        )}
      </div>
      <label className="field">
        {t.importer.found(parsed.length)}
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
          {names.includes("未分配") && names.length <= 2
            ? t.importer.unassigned
            : t.importer.twoPeople}
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
        {t.importer.import}
      </button>
      <p className="import-hint">{t.importer.note}</p>
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
  const t = useT();
  return (
    <Modal title={t.importer.overlapTitle} close={close}>
      <p>{t.importer.overlapBody}</p>
      <button className="primary" onClick={onSkip}>
        {t.importer.skip}
      </button>
      <button className="secondary" onClick={onAppend}>
        {t.importer.append}
      </button>
    </Modal>
  );
}
