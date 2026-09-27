"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, formatMoney, isNetworkFailure } from "@/lib/api";
import { PortfolioCharts } from "@/components/portfolio-charts";
import { CoinAvatar } from "@/components/ui/coin-avatar";
import { getCryptoMeta } from "@/lib/crypto-meta";
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
  const [showBalance, setShowBalance] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("nextfi-show-balance");
    if (stored === "false") setShowBalance(false);
  }, []);

  function toggleBalance() {
    setShowBalance((current) => {
      const next = !current;
      localStorage.setItem("nextfi-show-balance", String(next));
      return next;
    });
  }

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

    void load();

    const onOnline = () => void load();
    const onOffline = () => setOffline(true);
    const onDataUpdated = () => void load();

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
    return <div className="app-page"><div className="skeleton-card">Loading your portfolio…</div></div>;
  }

  const { totals, currency, assets } = summary;
  const positive = totals.lifetimePnl >= 0;
  const assetCount = assets.length;
  const purchaseCount = assets.reduce((sum, asset) => sum + asset.buyCount, 0);

  return (
    <div className="app-page fintech-dashboard">
      <div className="mobile-welcome">
        <div>
          <span className="eyebrow">Portfolio</span>
          <strong>Good to see you.</strong>
        </div>
        {offline && <span className="status-pill">Offline</span>}
      </div>

      <section className="portfolio-hero">
        <div className="portfolio-hero-top">
          <div>
            <span className="metric-label">{offline ? "Last synchronized value" : "Total portfolio value"}</span>
            <div className="balance-row">
              <strong className={showBalance ? "hero-number" : "hero-number balance-hidden"}>
                {showBalance ? formatMoney(totals.currentValue, currency) : "••••••"}
              </strong>
              <button type="button" className="balance-toggle" onClick={toggleBalance} aria-label={showBalance ? "Hide portfolio balance" : "Show portfolio balance"}>
                {showBalance ? "Hide" : "Show"}
              </button>
            </div>
            <span className={positive ? "gain hero-change" : "loss hero-change"}>
              {positive ? "▲" : "▼"} {showBalance ? `${positive ? "+" : ""}${formatMoney(totals.lifetimePnl, currency)} · ${totals.returnPct.toFixed(2)}%` : "Portfolio performance hidden"}
            </span>
          </div>
          <span className="hero-currency-chip">{currency}</span>
        </div>

        <div className="portfolio-hero-stats">
          <div><span>Invested</span><strong>{showBalance ? formatMoney(totals.invested, currency) : "••••"}</strong></div>
          <div><span>Unrealized P/L</span><strong className={totals.unrealizedPnl >= 0 ? "gain" : "loss"}>{showBalance ? formatMoney(totals.unrealizedPnl, currency) : "••••"}</strong></div>
          <div><span>Realized P/L</span><strong className={totals.realizedPnl >= 0 ? "gain" : "loss"}>{showBalance ? formatMoney(totals.realizedPnl, currency) : "••••"}</strong></div>
        </div>
      </section>

      <section className="quick-actions" aria-label="Quick actions">
        <button type="button" onClick={() => window.dispatchEvent(new Event("nextfi-open-transaction"))}>
          <span>＋</span><strong>Add DCA</strong><small>Record a transaction</small>
        </button>
        <Link href="/app/portfolio">
          <span>◫</span><strong>Portfolio</strong><small>View every position</small>
        </Link>
        <Link href="/app/dca-plans">
          <span>◎</span><strong>DCA plans</strong><small>Set your cadence</small>
        </Link>
      </section>

      <div className="dashboard-section-head">
        <div><span className="eyebrow">Your assets</span><h2>Positions</h2></div>
        <Link href="/app/portfolio">View all</Link>
      </div>

      <section className="home-asset-list panel">
        {assets.slice(0, 5).map((asset) => {
          const meta = getCryptoMeta(asset.symbol);
          return (
            <Link href="/app/portfolio" className="home-asset-row" key={asset.symbol}>
              <CoinAvatar symbol={asset.symbol} size={42} />
              <div className="home-asset-name">
                <strong>{meta.name}</strong>
                <span>{asset.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })} {asset.symbol}</span>
              </div>
              <div className="home-asset-value">
                <strong>{showBalance ? formatMoney(asset.currentValue, currency) : "••••"}</strong>
                <span className={asset.returnPct >= 0 ? "gain" : "loss"}>{asset.returnPct >= 0 ? "▲" : "▼"} {Math.abs(asset.returnPct).toFixed(2)}%</span>
              </div>
            </Link>
          );
        })}
        {!assets.length && (
          <div className="empty-state compact">
            <h2>No crypto positions yet.</h2>
            <p>Record your first DCA and NextFi will build your cost basis automatically.</p>
            <button className="button button-dark" type="button" onClick={() => window.dispatchEvent(new Event("nextfi-open-transaction"))}>Add first transaction</button>
          </div>
        )}
      </section>

      <section className="metric-grid dashboard-metrics">
        <article className="panel metric-card">
          <span className="metric-label">Assets tracked</span>
          <strong>{assetCount}</strong>
          <p>Crypto positions built from your ledger.</p>
        </article>
        <article className="panel metric-card">
          <span className="metric-label">DCA purchases</span>
          <strong>{purchaseCount}</strong>
          <p>Every buy contributes to weighted average cost.</p>
        </article>
        <article className="panel metric-card">
          <span className="metric-label">Sync status</span>
          <strong>{offline ? "Offline" : pendingCount ? `${pendingCount} pending` : "Up to date"}</strong>
          <p>{offline ? `Cached ${cachedAt ? new Date(cachedAt).toLocaleString() : "locally"}.` : "Portfolio and market-dependent values are synchronized."}</p>
        </article>
      </section>

      <div className="dashboard-section-head analytics-title">
        <div><span className="eyebrow">Analytics</span><h2>Portfolio breakdown</h2></div>
      </div>
      <PortfolioCharts assets={assets} currency={currency} />
    </div>
  );
}
