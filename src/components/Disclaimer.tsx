import { Modal } from "./ui";
import { useT } from "../i18n";

export const DISCLAIMER_KEY = "crush-monitor-disclaimer-v1";

export function DisclaimerModal({
  accepted,
  onAccept,
  onClose,
}: {
  accepted: boolean;
  onAccept: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const d = t.disclaimer;
  return (
    <Modal
      title={d.title}
      // Before acceptance the only way out is to accept.
      close={() => accepted && onClose()}
      closable={accepted}
    >
      <div className="disclaimer">
        <h3>{d.funTitle}</h3>
        <p>{d.fun}</p>
        <h3>{d.privacyTitle}</h3>
        <p>{d.privacy}</p>
        <h3>{d.costTitle}</h3>
        <p>{d.cost}</p>
        <h3>{d.banTitle}</h3>
        <p>{d.ban}</p>
        <h3>{d.liabilityTitle}</h3>
        <p>{d.liability}</p>
      </div>
      {accepted ? (
        <button className="secondary" onClick={onClose}>
          {t.close}
        </button>
      ) : (
        <button className="primary" onClick={onAccept}>
          {d.accept}
        </button>
      )}
    </Modal>
  );
}
