"use client";

import { useEffect, useState } from "react";
import { apiFetch, formatMoney } from "@/lib/api";

type Asset = {
  symbol: string;
  quantity: number;
  totalBuyContributions: number;
  remainingCostBasis: number;
  averageEntry: number;
  breakEven: number;
  realizedPnl: number;
  totalFees: number;
  buyCount: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnl: number;
  returnPct: number;
  marketSource: string;
};

type Summary = {
  currency: string;
  user: { email: string };
  totals: {
    invested: number;
    currentValue: number;
    unrealizedPnl: number;
    realizedPnl: number;
    lifetimePnl: number;
    fees: number;
    returnPct: number;
  };
  assets: Asset[];
};

export function DashboardClient() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<Summary>("/portfolio/summary")
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load portfolio."));
  }, []);

  if (error) {
    return <div className="app-page"><div className="form-error">{error}</div></div>;
  }

  if (!summary) {
    return <div className="app-page"><div className="skeleton-card">Loading portfolio…</div></div>;
  }

  const { totals, currency, assets } = summary;
  const positive = totals.lifetimePnl >= 0;

  return (
    <div className="app-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Portfolio overview</span>
          <h1>Your DCA, without the guesswork.</h1>
          <p>Actual contributions, weighted cost and live value in {currency}.</p>
        </div>
        <span className="status-pill">Base currency · {currency}</span>
      </div>

      <section className="hero-metric panel">
        <div>
          <span className="metric-label">Current portfolio value</span>
          <strong className="hero-number">{formatMoney(totals.currentValue, currency)}</strong>
          <span className={positive ? "gain" : "loss"}>
            {positive ? "+" : ""}{formatMoney(totals.lifetimePnl, currency)} · {totals.returnPct.toFixed(2)}%
          </span>
        </div>

        <div className="hero-mini-grid">
          <div>
            <span>Actual invested</span>
            <strong>{formatMoney(totals.invested, currency)}</strong>
          </div>
          <div>
            <span>Unrealized P/L</span>
            <strong>{formatMoney(totals.unrealizedPnl, currency)}</strong>
          </div>
          <div>
            <span>Realized P/L</span>
            <strong>{formatMoney(totals.realizedPnl, currency)}</strong>
          </div>
          <div>
            <span>Fees tracked</span>
            <strong>{formatMoney(totals.fees, currency)}</strong>
          </div>
        </div>
      </section>

      <section className="metric-grid">
        <article className="panel metric-card">
          <span className="metric-label">Assets tracked</span>
          <strong>{assets.length}</strong>
          <p>Built from your transaction ledger.</p>
        </article>
        <article className="panel metric-card">
          <span className="metric-label">DCA purchases</span>
          <strong>{assets.reduce((sum, asset) => sum + asset.buyCount, 0)}</strong>
          <p>Every buy contributes to weighted cost.</p>
        </article>
        <article className="panel metric-card">
          <span className="metric-label">Market status</span>
          <strong>{assets.some((asset) => asset.marketSource === "live") ? "Live" : "Fallback"}</strong>
          <p>Falls back to last entry if the market provider is unavailable.</p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Positions</span>
            <h2>Average entry and break-even</h2>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Holdings</th>
                <th>Avg. entry</th>
                <th>Break-even</th>
                <th>Current price</th>
                <th>Current value</th>
                <th>P/L</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.symbol}>
                  <td><strong>{asset.symbol}</strong></td>
                  <td>{asset.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}</td>
                  <td>{formatMoney(asset.averageEntry, currency)}</td>
                  <td>{formatMoney(asset.breakEven, currency)}</td>
                  <td>{formatMoney(asset.currentPrice, currency)}</td>
                  <td><strong>{formatMoney(asset.currentValue, currency)}</strong></td>
                  <td className={asset.unrealizedPnl >= 0 ? "gain" : "loss"}>
                    {asset.unrealizedPnl >= 0 ? "+" : ""}{formatMoney(asset.unrealizedPnl, currency)}
                    <small>{asset.returnPct.toFixed(2)}%</small>
                  </td>
                </tr>
              ))}
              {!assets.length && (
                <tr>
                  <td colSpan={7} className="empty-cell">No positions yet. Add your first DCA transaction.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
