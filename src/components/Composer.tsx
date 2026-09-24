import { useRef, type ReactNode } from "react";
import { FileUp, Send } from "lucide-react";
import { decodeText } from "./ui";

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
  return (
    <div className="composer">
      <textarea
        aria-label="粘贴聊天记录"
        disabled={!ready}
        placeholder={
          hasChat ? "粘贴新的聊天，自动合并重复记录" : "在这里粘贴聊天记录…"
        }
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onPaste={(e) => {
          const t = e.clipboardData.getData("text");
          if (t.trim()) {
            e.preventDefault();
            setInput(t);
            onSubmit(t);
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
            title="选择导出的 .txt 聊天记录；同一个人的记录可以多次导入，重复部分会自动合并"
          >
            <FileUp size={15} />
            导入文件
          </button>
          <button
            className="send"
            disabled={!input.trim()}
            onClick={() => onSubmit(input)}
          >
            <Send size={15} />
            导入聊天
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
