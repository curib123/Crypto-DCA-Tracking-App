"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, formatMoney, isNetworkFailure } from "@/lib/api";
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

type Frequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

type DcaPlan = {
  id: string;
  assetSymbol: string;
  amount: string | number;
  quoteCurrency: string;
  frequency: Frequency;
  startDate: string;
  enabled: boolean;
};

type Transaction = {
  id: string;
  type: string;
  amountSpent: string | number;
  fxRateToBase: string | number;
  occurredAt: string;
};

function nextDue(plan: DcaPlan) {
  const now = new Date();
  const due = new Date(plan.startDate);
  let guard = 0;

  while (due.getTime() < now.getTime() && guard < 600) {
    if (plan.frequency === "WEEKLY") due.setDate(due.getDate() + 7);
    else if (plan.frequency === "BIWEEKLY") due.setDate(due.getDate() + 14);
    else due.setMonth(due.getMonth() + 1);
    guard += 1;
  }

  return due;
}

function monthlyEquivalent(plan: DcaPlan) {
  const amount = Number(plan.amount);
  if (plan.frequency === "WEEKLY") return amount * 52 / 12;
  if (plan.frequency === "BIWEEKLY") return amount * 26 / 12;
  return amount;
}

function isThisMonth(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function DashboardClient() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [plans, setPlans] = useState<DcaPlan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
        const [cached, queued, cachedTransactions] = await Promise.all([
          getCachedUserResource<Summary>(activeUser.id, "portfolio"),
          pendingTransactions(activeUser.id),
          getCachedUserResource<Transaction[]>(activeUser.id, "transactions"),
        ]);

        if (!mounted) return;

        setPendingCount(queued.length);
        if (cachedTransactions) setTransactions(cachedTransactions.value);

        if (cached) {
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

        const [planResult, transactionResult] = await Promise.allSettled([
          apiFetch<DcaPlan[]>("/dca-plans"),
          apiFetch<Transaction[]>("/transactions"),
        ]);

        if (mounted && planResult.status === "fulfilled") {
          setPlans(planResult.value);
        }

        if (mounted && transactionResult.status === "fulfilled") {
          setTransactions(transactionResult.value);
          const owner = activeUser || await getActiveUser();
          if (owner) await cacheUserResource(owner.id, "transactions", transactionResult.value);
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

  const dcaMetrics = useMemo(() => {
    if (!summary) {
      return {
        monthlyTarget: 0,
        contributedThisMonth: 0,
        progress: 0,
        nextPlan: null as DcaPlan | null,
        nextDate: null as Date | null,
        mixedPlanCurrencies: false,
      };
    }

    const active = plans.filter((plan) => plan.enabled);
    const compatible = active.filter((plan) => plan.quoteCurrency === summary.currency);
    const monthlyTarget = compatible.reduce((sum, plan) => sum + monthlyEquivalent(plan), 0);

    const contributedThisMonth = transactions
      .filter((row) => row.type === "BUY" && isThisMonth(row.occurredAt))
      .reduce((sum, row) => sum + Number(row.amountSpent) * Number(row.fxRateToBase || 1), 0);

    const next = active
      .map((plan) => ({ plan, due: nextDue(plan) }))
      .sort((a, b) => a.due.getTime() - b.due.getTime())[0];

    return {
      monthlyTarget,
      contributedThisMonth,
      progress: monthlyTarget > 0 ? Math.min(100, contributedThisMonth / monthlyTarget * 100) : 0,
      nextPlan: next?.plan || null,
      nextDate: next?.due || null,
      mixedPlanCurrencies: compatible.length !== active.length,
    };
  }, [plans, summary, transactions]);

  if (error && !summary) {
    return <div className="app-page"><div className="form-error">{error}</div></div>;
  }

  if (!summary) {
    return <div className="app-page"><div className="skeleton-card">Loading your DCA progress…</div></div>;
  }

  const { totals, currency, assets } = summary;
  const positive = totals.lifetimePnl >= 0;
  const oneYearAdditional = dcaMetrics.monthlyTarget * 12;
  const fiveYearAdditional = dcaMetrics.monthlyTarget * 60;

  return (
    <div className="app-page fintech-dashboard dca-first-dashboard">
      <div className="mobile-welcome">
        <div>
          <span className="eyebrow">Your DCA</span>
          <strong>Know exactly where you stand.</strong>
        </div>
        {offline && <span className="status-pill">Offline</span>}
      </div>

      <section className="portfolio-hero">
        <div className="portfolio-hero-top">
          <div>
            <span className="metric-label">{offline ? "Last synchronized value" : "Current portfolio value"}</span>
            <div className="balance-row">
              <strong className={showBalance ? "hero-number" : "hero-number balance-hidden"}>
                {showBalance ? formatMoney(totals.currentValue, currency) : "••••••"}
              </strong>
              <button type="button" className="balance-toggle" onClick={toggleBalance} aria-label={showBalance ? "Hide portfolio balance" : "Show portfolio balance"}>
                {showBalance ? "Hide" : "Show"}
              </button>
            </div>
            <span className={positive ? "gain hero-change" : "loss hero-change"}>
              {positive ? "▲ " : "▼ "}
              {showBalance
                ? (positive ? "+" : "") + formatMoney(totals.lifetimePnl, currency) + " · " + totals.returnPct.toFixed(2) + "%"
                : "Performance hidden"}
            </span>
          </div>
          <span className="hero-currency-chip">{currency}</span>
        </div>

        <div className="portfolio-hero-stats">
          <div><span>Total invested</span><strong>{showBalance ? formatMoney(totals.invested, currency) : "••••"}</strong></div>
          <div><span>Total profit</span><strong className={totals.lifetimePnl >= 0 ? "gain" : "loss"}>{showBalance ? formatMoney(totals.lifetimePnl, currency) : "••••"}</strong></div>
          <div><span>Return</span><strong className={totals.returnPct >= 0 ? "gain" : "loss"}>{showBalance ? (totals.returnPct >= 0 ? "+" : "") + totals.returnPct.toFixed(2) + "%" : "••••"}</strong></div>
        </div>
      </section>

      <section className="dca-focus-grid">
        <article className="panel dca-progress-card">
          <div className="dca-focus-head">
            <div>
              <span className="eyebrow">This month</span>
              <h2>DCA progress</h2>
            </div>
            <Link href="/app/dca-plans">Edit plan</Link>
          </div>

          {dcaMetrics.monthlyTarget > 0 ? (
            <>
              <div className="dca-progress-numbers">
                <strong>{formatMoney(dcaMetrics.contributedThisMonth, currency)}</strong>
                <span>of {formatMoney(dcaMetrics.monthlyTarget, currency)}</span>
              </div>
              <div className="dca-progress-track" aria-label={dcaMetrics.progress.toFixed(0) + " percent of monthly DCA target"}>
                <span style={{ width: dcaMetrics.progress + "%" }} />
              </div>
              <div className="dca-progress-foot">
                <span>{dcaMetrics.progress.toFixed(0)}% complete</span>
                <span>{formatMoney(Math.max(0, dcaMetrics.monthlyTarget - dcaMetrics.contributedThisMonth), currency)} remaining</span>
              </div>
              {dcaMetrics.mixedPlanCurrencies && <small className="muted">Progress uses active plans in your {currency} reporting currency.</small>}
            </>
          ) : (
            <div className="dca-empty-compact">
              <strong>No monthly target yet.</strong>
              <p>Create a DCA plan and NextFi will turn it into a simple monthly progress target.</p>
              <Link className="button button-light button-small" href="/app/dca-plans">Create DCA plan</Link>
            </div>
          )}
        </article>

        <article className="panel next-dca-card">
          <span className="eyebrow">Next DCA</span>
          {dcaMetrics.nextPlan && dcaMetrics.nextDate ? (
            <>
              <strong>{dcaMetrics.nextDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</strong>
              <p>{formatMoney(Number(dcaMetrics.nextPlan.amount), dcaMetrics.nextPlan.quoteCurrency)} · {dcaMetrics.nextPlan.assetSymbol}</p>
              <button type="button" className="button button-dark button-small" onClick={() => window.dispatchEvent(new CustomEvent("nextfi-open-transaction", { detail: { asset: dcaMetrics.nextPlan?.assetSymbol } }))}>
                Record this DCA
              </button>
            </>
          ) : (
            <>
              <strong>Not scheduled</strong>
              <p>Add a weekly, biweekly or monthly plan.</p>
              <Link className="button button-light button-small" href="/app/dca-plans">Set schedule</Link>
            </>
          )}
        </article>
      </section>

      <section className="quick-actions" aria-label="Quick actions">
        <button type="button" onClick={() => window.dispatchEvent(new Event("nextfi-open-transaction"))}>
          <span>＋</span><strong>Add DCA</strong><small>Record a purchase</small>
        </button>
        <Link href="/app/transactions">
          <span>≡</span><strong>History</strong><small>See every purchase</small>
        </Link>
        <Link href="/app/dca-plans">
          <span>◎</span><strong>DCA plan</strong><small>Schedule your next buy</small>
        </Link>
      </section>

      <div className="dashboard-section-head">
        <div><span className="eyebrow">By coin</span><h2>Average entry & performance</h2></div>
        <Link href="/app/portfolio">View portfolio</Link>
      </div>

      <section className="home-asset-list panel dca-asset-list">
        {assets.slice(0, 5).map((asset) => {
          const meta = getCryptoMeta(asset.symbol);
          return (
            <Link href="/app/portfolio" className="home-asset-row dca-asset-row" key={asset.symbol}>
              <CoinAvatar symbol={asset.symbol} size={42} />
              <div className="home-asset-name">
                <strong>{meta.name}</strong>
                <span>{asset.symbol} · Avg. {formatMoney(asset.averageEntry, currency)}</span>
              </div>
              <div className="home-asset-value">
                <strong>{showBalance ? formatMoney(asset.currentValue, currency) : "••••"}</strong>
                <span className={asset.returnPct >= 0 ? "gain" : "loss"}>{asset.returnPct >= 0 ? "+" : ""}{asset.returnPct.toFixed(2)}%</span>
              </div>
            </Link>
          );
        })}
        {!assets.length && (
          <div className="empty-state compact">
            <h2>Your first DCA starts here.</h2>
            <p>Record a purchase and NextFi will calculate your average entry and profit/loss automatically.</p>
            <button className="button button-dark" type="button" onClick={() => window.dispatchEvent(new Event("nextfi-open-transaction"))}>Add first DCA</button>
          </div>
        )}
      </section>

      <section className="panel dca-pace-card">
        <div className="dca-focus-head">
          <div>
            <span className="eyebrow">What if I keep investing?</span>
            <h2>Your contribution pace</h2>
          </div>
          <Link href="/dca-calculator">Open calculator</Link>
        </div>

        {dcaMetrics.monthlyTarget > 0 ? (
          <div className="dca-pace-grid">
            <div><span>Monthly DCA</span><strong>{formatMoney(dcaMetrics.monthlyTarget, currency)}</strong></div>
            <div><span>Additional in 1 year</span><strong>{formatMoney(oneYearAdditional, currency)}</strong></div>
            <div><span>Additional in 5 years</span><strong>{formatMoney(fiveYearAdditional, currency)}</strong></div>
          </div>
        ) : (
          <p className="muted">Create a DCA plan to see how your contribution habit adds up over time.</p>
        )}
        <small className="muted">Contribution projection only. It does not assume or predict crypto price growth.</small>
      </section>

      {(offline || pendingCount > 0) && (
        <p className="data-disclaimer">
          {offline ? "Offline view · synchronized " + (cachedAt ? new Date(cachedAt).toLocaleString() : "previously") + ". " : ""}
          {pendingCount > 0 ? pendingCount + " purchase" + (pendingCount === 1 ? "" : "s") + " waiting to sync." : ""}
        </p>
      )}
    </div>
  );
}
