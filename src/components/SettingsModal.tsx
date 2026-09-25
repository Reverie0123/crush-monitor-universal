import { Modal } from "./ui";
import { AvatarPicker } from "../AvatarPicker";
import { ModelSettings, type PublicConfig } from "../ModelSettings";
import type { Avatars } from "../storage";
import { useLang } from "../i18n";
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
  analysisRunning,
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
  analysisRunning: boolean;
  on: { swap: () => void; clear: () => void; disclaimer: () => void };
  close: () => void;
}) {
  const { t, lang, setLang } = useLang();
  const me = self && self !== "__self_absent__" ? self : t.me;
  return (
    <Modal title={t.settings.title} close={close}>
      <div className="field">
        {t.settings.language}
        <div
          className="preset-row"
          role="group"
          aria-label={t.settings.language}
        >
          <button
            className={lang === "zh" ? "selected" : ""}
            aria-pressed={lang === "zh"}
            onClick={() => setLang("zh")}
            lang="zh"
          >
            中文
          </button>
          <button
            className={lang === "en" ? "selected" : ""}
            aria-pressed={lang === "en"}
            onClick={() => setLang("en")}
            lang="en"
          >
            English
          </button>
        </div>
      </div>
      <label className="field">
        {t.settings.relation}
        <select
          value={relation}
          onChange={(e) => setRelation(e.target.value as Relation)}
        >
          {[...new Set(RELATION_KEYS.map((k) => RELATION_INFO[k].group))].map(
            (group) => (
              <optgroup label={t.relationGroups[group] ?? group} key={group}>
                {RELATION_KEYS.filter(
                  (k) => RELATION_INFO[k].group === group,
                ).map((k) => (
                  <option value={k} key={k}>
                    {t.relations[k]}
                  </option>
                ))}
              </optgroup>
            ),
          )}
        </select>
      </label>
      <p className="relation-hint">{t.relationHints[relation]}</p>
      <label className="field">
        {t.settings.note}
        <textarea
          rows={3}
          maxLength={500}
          value={noteDraft}
          placeholder={t.settings.notePlaceholder}
          onChange={(e) => setNoteDraft(e.target.value)}
        />
      </label>
      {noteDraft.trim() !== note && (
        <button className="primary" onClick={saveNote}>
          {t.settings.saveNote}
        </button>
      )}
      <button className="secondary" disabled={!messageCount} onClick={on.swap}>
        {t.settings.swap}
      </button>
      <button className="secondary danger" onClick={on.clear}>
        {t.settings.clear}
      </button>
      <button className="secondary" onClick={on.disclaimer}>
        {t.settings.disclaimer}
      </button>
      <p>{t.settings.saved(messageCount)}</p>
      <details className="settings-section">
        <summary>{t.settings.avatars}</summary>
        <div className="avatar-pickers">
          <AvatarPicker
            label={t.me}
            name={me}
            src={avatars.self}
            mine
            onChange={(src) => updateAvatars((v) => ({ ...v, self: src }))}
          />
          <AvatarPicker
            label={messageCount ? other : t.other}
            name={other}
            src={avatars.other}
            onChange={(src) => updateAvatars((v) => ({ ...v, other: src }))}
          />
        </div>
        <p>{t.settings.avatarNote}</p>
      </details>
      <details className="settings-section" open={!configured}>
        <summary>{t.settings.model}</summary>
        <ModelSettings onSaved={onConfig} locked={analysisRunning} />
      </details>
      <p className="app-version">{t.settings.version(__APP_VERSION__)}</p>
    </Modal>
  );
}
