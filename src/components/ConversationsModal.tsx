import { useEffect, useRef, useState } from "react";
import { Download, FolderOpen, Trash2, Upload } from "lucide-react";
import { Modal } from "./ui";
import { useT } from "../i18n";
import { listLibrary, type LibraryEntry } from "../storage";

/** The chats put aside: open one, export any as JSON, import one, or delete. */
export function ConversationsModal({
  current,
  on,
  close,
}: {
  /** The chat on screen, if there is one. */
  current: { other: string; count: number } | null;
  on: {
    open: (id: string) => Promise<void>;
    remove: (id: string) => Promise<void>;
    exportCurrent: () => void;
    exportEntry: (id: string) => Promise<void>;
    importFile: (file: File) => Promise<void>;
    newChat: () => Promise<void>;
  };
  close: () => void;
}) {
  const t = useT();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const refresh = () => listLibrary().then(setEntries, () => setEntries([]));
  useEffect(() => {
    void refresh();
  }, []);
  const when = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  return (
    <Modal title={t.library.title} close={close}>
      <div className="library">
        <section className="library-current">
          <strong>{t.library.current}</strong>
          {current ? (
            <>
              <span>{t.library.entry(current.other, current.count)}</span>
              <div className="library-actions">
                <button className="secondary" onClick={on.exportCurrent}>
                  <Download size={14} /> {t.library.exportJson}
                </button>
                <button
                  className="secondary"
                  onClick={() => void on.newChat().then(refresh)}
                >
                  {t.library.newChat}
                </button>
              </div>
            </>
          ) : (
            <span>{t.library.noCurrent}</span>
          )}
        </section>
        {entries.length ? (
          <ul className="library-list">
            {entries.map((e) => (
              <li key={e.id}>
                <span>
                  {t.library.entry(e.other, e.count)} · {when(e.updatedAt)}
                </span>
                <div className="library-actions">
                  <button
                    className="secondary"
                    onClick={() => void on.open(e.id).then(close)}
                  >
                    <FolderOpen size={14} /> {t.library.open}
                  </button>
                  <button
                    className="secondary"
                    onClick={() => void on.exportEntry(e.id)}
                  >
                    <Download size={14} /> {t.library.export}
                  </button>
                  {confirming === e.id ? (
                    <button
                      className="secondary danger"
                      onClick={() =>
                        void on.remove(e.id).then(() => {
                          setConfirming(null);
                          return refresh();
                        })
                      }
                    >
                      {t.library.confirmDelete}
                    </button>
                  ) : (
                    <button
                      className="secondary"
                      onClick={() => setConfirming(e.id)}
                    >
                      <Trash2 size={14} /> {t.library.delete}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="settings-note">{t.library.empty}</p>
        )}
        <div className="library-actions">
          <button
            className="secondary"
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={14} /> {t.library.importJson}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            aria-label={t.library.importJson}
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setError("");
              void on.importFile(file).then(close, () =>
                setError(t.library.importFailed),
              );
            }}
          />
        </div>
        {error && <p className="settings-note library-error">{error}</p>}
        <p className="settings-note">{t.library.note}</p>
      </div>
    </Modal>
  );
}
