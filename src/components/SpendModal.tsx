import { useState } from "react";
import { Modal } from "./ui";
import { calibrate, formatTokens, formatYuan, savePrices } from "../cost";
import type { UsageTotal } from "../useAnalysis";
import type { Spend } from "../useSpend";

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
  const { prices } = spend;
  const rows: [string, string][] = [
    ["分析请求", `${usage.requests.toLocaleString()} 次`],
    ["输入 tokens", formatTokens(usage.input)],
    ["其中缓存命中", formatTokens(usage.cached)],
    ["输出 tokens", formatTokens(usage.output)],
    ["按单价估算", formatYuan(spend.spent)],
  ];
  return (
    <Modal title="花费" close={close}>
      <div className="spend-table">
        {rows.map(([k, v]) => (
          <div key={k}>
            <span>{k}</span>
            <b>{v}</b>
          </div>
        ))}
      </div>
      <h3>单次分析花费上限</h3>
      <p>
        一次分析的花费超过这个数就自动暂停，已完成的部分会保留，调高后可以接着分析。留空表示不限。
      </p>
      <label className="field">
        上限（元）
        <input
          type="number"
          min={0}
          step={0.5}
          value={budget}
          placeholder="例如 5"
          onChange={(e) => setBudget(e.target.value)}
        />
      </label>
      <button
        className="secondary"
        onClick={() =>
          spend.setBudget(Number(budget) > 0 ? Number(budget) : null)
        }
      >
        {spend.budget ? `保存（当前 ¥${spend.budget}）` : "保存上限"}
      </button>
      <h3>按实际账单校准</h3>
      <p>
        单价在设置的「模型与接口」里可以改。服务商分高峰、低谷时段定价，估算难免有偏差。
        {prices.factor !== 1 &&
          ` 当前已按你的账单校准（×${prices.factor.toFixed(2)}）。`}
        {spend.estimateFactor !== 1 &&
          ` 预估还按过去几次分析的实际用量自动修正了（×${spend.estimateFactor.toFixed(2)}）。`}
      </p>
      <label className="field">
        上面这些分析实际花了多少元？
        <input
          type="number"
          min={0}
          step={0.01}
          value={bill}
          placeholder="例如 8.3"
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
        校准
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
          取消校准
        </button>
      )}
    </Modal>
  );
}
