"use client";

import { useEffect, useState } from "react";
import { apiFetch, formatMoney, isNetworkFailure } from "@/lib/api";
import {
  cacheUserResource,
  getActiveUser,
  getCachedUserResource,
  pendingTransactions,
} from "@/lib/offline";

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
  const [offline, setOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const activeUser = await getActiveUser();

      if (activeUser) {
        const [cached, queued] = await Promise.all([
          getCachedUserResource<Summary>(activeUser.id, "portfolio"),
          pendingTransactions(activeUser.id),
        ]);
        setPendingCount(queued.length);
        if (cached && mounted) {
          setSummary(cached.value);
          setCachedAt(cached.updatedAt);
          setOffline(!navigator.onLine);
        }
      }

      if (!navigator.onLine) {
        if (!activeUser && mounted) setError("No synchronized portfolio is available offline yet.");
        return;
      }

      try {
        const fresh = await apiFetch<Summary>("/portfolio/summary");
        if (!activeUser) {
          const latestUser = await getActiveUser();
          if (latestUser) await cacheUserResource(latestUser.id, "portfolio", fresh);
        } else {
          await cacheUserResource(activeUser.id, "portfolio", fresh);
        }

        if (mounted) {
          setSummary(fresh);
          setCachedAt(new Date().toISOString());
          setOffline(false);
          setError("");
        }
      } catch (err) {
        if (mounted && !summary) {
          setError(
            isNetworkFailure(err)
              ? "Unable to reach the server and no synchronized portfolio is cached on this device."
              : err instanceof Error
                ? err.message
                : "Unable to load portfolio.",
          );
        }
      }
    }

    load();

    const onOnline = () => load();
    const onOffline = () => setOffline(true);
    const onDataUpdated = () => load();

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("crypto-dca-data-updated", onDataUpdated);

    return () => {
      mounted = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("crypto-dca-data-updated", onDataUpdated);
    };
  }, []);

  if (error && !summary) {
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
          <p>
            Actual contributions, weighted cost and {offline ? "last synchronized" : "current"} value in {currency}.
          </p>
        </div>
        <div className="heading-statuses">
          {offline && (
            <span className="status-pill">
              Offline · cached {cachedAt ? new Date(cachedAt).toLocaleString() : "previously"}
            </span>
          )}
          {pendingCount > 0 && (
            <span className="status-pill">
              {pendingCount} pending · totals update after sync
            </span>
          )}
          <span className="status-pill">Base currency · {currency}</span>
        </div>
      </div>

      <section className="hero-metric panel">
        <div>
          <span className="metric-label">{offline ? "Last synchronized portfolio value" : "Current portfolio value"}</span>
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
          <span className="metric-label">Data status</span>
          <strong>{offline ? "Offline cache" : assets.some((asset) => asset.marketSource === "live") ? "Live" : "Fallback"}</strong>
          <p>{offline ? "Reconnect to refresh market-dependent values." : "Falls back to last entry if market data is unavailable."}</p>
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
