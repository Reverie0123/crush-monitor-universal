import { useState } from "react";
import { Modal } from "./ui";
import { calibrate, formatTokens, formatYuan, savePrices } from "../cost";
import type { UsageTotal } from "../useAnalysis";
import type { Spend } from "../useSpend";
import { useT } from "../i18n";

export function SpendModal({
  usage,
  spend,
  close,
}: {
  usage: UsageTotal;
  spend: Spend;
  close: () => void;
}) {
  const [bill, setBill] = useState("");
  const [budget, setBudget] = useState(
    spend.budget ? String(spend.budget) : "",
  );
  const t = useT();
  const { prices } = spend;
  const rows: [string, string][] = [
    [t.spend.requests, t.spend.requestsValue(usage.requests.toLocaleString())],
    [t.spend.input, formatTokens(usage.input)],
    [t.spend.cached, formatTokens(usage.cached)],
    [t.spend.output, formatTokens(usage.output)],
    [t.spend.estimated, formatYuan(spend.spent)],
  ];
  return (
    <Modal title={t.spend.title} close={close}>
      <div className="spend-table">
        {rows.map(([k, v]) => (
          <div key={k}>
            <span>{k}</span>
            <b>{v}</b>
          </div>
        ))}
      </div>
      <h3>{t.spend.capTitle}</h3>
      <p>{t.spend.capNote}</p>
      <label className="field">
        {t.spend.capLabel}
        <input
          type="number"
          min={0}
          step={0.5}
          value={budget}
          placeholder={t.spend.capPlaceholder}
          onChange={(e) => setBudget(e.target.value)}
        />
      </label>
      <button
        className="secondary"
        onClick={() =>
          spend.setBudget(Number(budget) > 0 ? Number(budget) : null)
        }
      >
        {t.spend.capSave(spend.budget)}
      </button>
      <h3>{t.spend.calibrateTitle}</h3>
      <p>
        {t.spend.calibrateNote}
        {prices.factor !== 1 && t.spend.calibrated(prices.factor.toFixed(2))}
        {spend.estimateFactor !== 1 &&
          t.spend.learned(spend.estimateFactor.toFixed(2))}
      </p>
      <label className="field">
        {t.spend.billLabel}
        <input
          type="number"
          min={0}
          step={0.01}
          value={bill}
          placeholder={t.spend.billPlaceholder}
          onChange={(e) => setBill(e.target.value)}
        />
      </label>
      <button
        className="primary"
        disabled={!(Number(bill) > 0)}
        onClick={() => {
          const next = calibrate(usage, prices, Number(bill));
          spend.setPrices(next);
          savePrices(next);
          setBill("");
        }}
      >
        {t.spend.calibrate}
      </button>
      {prices.factor !== 1 && (
        <button
          className="secondary"
          onClick={() => {
            const next = { ...prices, factor: 1 };
            spend.setPrices(next);
            savePrices(next);
          }}
        >
          {t.spend.uncalibrate}
        </button>
      )}
    </Modal>
  );
}
