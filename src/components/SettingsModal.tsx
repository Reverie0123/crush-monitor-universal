import { Modal } from "./ui";
import { AvatarPicker } from "../AvatarPicker";
import { ModelSettings, type PublicConfig } from "../ModelSettings";
import type { Avatars } from "../storage";
import {
  RELATION_INFO,
  RELATION_KEYS,
  type Relation,
} from "../../shared/types";

export function SettingsModal({
  relation,
  setRelation,
  note,
  noteDraft,
  setNoteDraft,
  saveNote,
  messageCount,
  self,
  other,
  avatars,
  updateAvatars,
  configured,
  onConfig,
  on,
  close,
}: {
  relation: Relation;
  setRelation: (r: Relation) => void;
  note: string;
  noteDraft: string;
  setNoteDraft: (v: string) => void;
  saveNote: () => void;
  messageCount: number;
  self: string;
  other: string;
  avatars: Avatars;
  updateAvatars: (change: (old: Avatars) => Avatars) => void;
  configured: boolean;
  onConfig: (c: PublicConfig) => void;
  on: { swap: () => void; clear: () => void; disclaimer: () => void };
  close: () => void;
}) {
  const me = self && self !== "__self_absent__" ? self : "我";
  return (
    <Modal title="聊天设置" close={close}>
      <label className="field">
        你们的关系
        <select
          value={relation}
          onChange={(e) => setRelation(e.target.value as Relation)}
        >
          {[...new Set(RELATION_KEYS.map((k) => RELATION_INFO[k].group))].map(
            (group) => (
              <optgroup label={group} key={group}>
                {RELATION_KEYS.filter(
                  (k) => RELATION_INFO[k].group === group,
                ).map((k) => (
                  <option value={k} key={k}>
                    {RELATION_INFO[k].label}
                  </option>
                ))}
              </optgroup>
            ),
          )}
        </select>
      </label>
      <p className="relation-hint">{RELATION_INFO[relation].context}</p>
      <label className="field">
        关系背景（选填，帮助模型理解语气）
        <textarea
          rows={3}
          maxLength={500}
          value={noteDraft}
          placeholder="例如：高中同学，认识三年；她打字一向很简短，不爱用表情；最近在准备考研比较忙"
          onChange={(e) => setNoteDraft(e.target.value)}
        />
      </label>
      {noteDraft.trim() !== note && (
        <button className="primary" onClick={saveNote}>
          保存背景
        </button>
      )}
      <button className="secondary" disabled={!messageCount} onClick={on.swap}>
        交换双方身份
      </button>
      <button className="secondary danger" onClick={on.clear}>
        清空聊天，重新开始
      </button>
      <button className="secondary" onClick={on.disclaimer}>
        免责声明与风险提示
      </button>
      <p>
        已保存 {messageCount.toLocaleString()}{" "}
        条聊天。记录保存在本机浏览器，刷新后可继续；分析时只发送所需片段给模型服务。改关系或背景后，底部会重新显示预计花费，确认后再分析。
      </p>
      <details className="settings-section">
        <summary>头像</summary>
        <div className="avatar-pickers">
          <AvatarPicker
            label="我"
            name={me}
            src={avatars.self}
            mine
            onChange={(src) => updateAvatars((v) => ({ ...v, self: src }))}
          />
          <AvatarPicker
            label={messageCount ? other : "对方"}
            name={other}
            src={avatars.other}
            onChange={(src) => updateAvatars((v) => ({ ...v, other: src }))}
          />
        </div>
        <p>
          图片会裁成正方形并压缩后保存在本机浏览器，不会发给模型；清空聊天时保留。
        </p>
      </details>
      <details className="settings-section" open={!configured}>
        <summary>模型与接口</summary>
        <ModelSettings onSaved={onConfig} />
      </details>
      <p className="app-version">
        版本 {__APP_VERSION__} · DeepSeek / OpenAI 改编版
      </p>
    </Modal>
  );
}
