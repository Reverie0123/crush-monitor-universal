import { useRef, type ReactNode } from "react";
import { FileUp, Send } from "lucide-react";
import { decodeText } from "./ui";
import { useT } from "../i18n";

/** Paste or import a chat. Parsing and merging happen in the parent. */
export function Composer({
  ready,
  hasChat,
  input,
  setInput,
  onSubmit,
  status,
}: {
  ready: boolean;
  hasChat: boolean;
  input: string;
  setInput: (v: string) => void;
  onSubmit: (text: string) => void;
  status: ReactNode;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const t = useT();
  return (
    <div className="composer">
      <textarea
        aria-label={t.composer.label}
        disabled={!ready}
        placeholder={
          hasChat ? t.composer.placeholderMore : t.composer.placeholderEmpty
        }
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (text.trim()) {
            e.preventDefault();
            setInput(text);
            onSubmit(text);
          }
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSubmit(input);
        }}
      />
      <div className="composer-bottom">
        {status}
        <div className="composer-actions">
          <button
            className="send secondary-send"
            disabled={!ready}
            onClick={() => fileInput.current?.click()}
            title={t.composer.fileTitle}
          >
            <FileUp size={15} />
            {t.composer.importFile}
          </button>
          <button
            className="send"
            disabled={!input.trim()}
            onClick={() => onSubmit(input)}
          >
            <Send size={15} />
            {t.composer.importChat}
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,text/plain"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const text = decodeText(await file.arrayBuffer());
            setInput(text);
            onSubmit(text);
          }}
        />
      </div>
    </div>
  );
}
