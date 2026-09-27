"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, formatMoney } from "@/lib/api";
import { AppModal } from "@/components/ui/app-modal";
import { CoinAvatar } from "@/components/ui/coin-avatar";
import { getCryptoMeta } from "@/lib/crypto-meta";

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

type PriceRow = {
  symbol: string;
  price: number;
  change24h: number;
  currency: string;
};

type MarketSnapshot = {
  prices: Record<string, PriceRow>;
  fetchedAt: string;
};

export function PortfolioClient() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [market, setMarket] = useState<Record<string, PriceRow>>({});
  const [selected, setSelected] = useState<Asset | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  async function load() {
    setError("");
    try {
      const next = await apiFetch<Summary>("/portfolio/summary");
      setSummary(next);
      try {
        const marketData = await apiFetch<MarketSnapshot>(`/market/prices?currency=${encodeURIComponent(next.currency)}`);
        setMarket(marketData.prices || {});
      } catch {
        setMarket({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load portfolio.");
    }
  }

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("crypto-dca-data-updated", refresh);
    return () => window.removeEventListener("crypto-dca-data-updated", refresh);
  }, []);

  const assets = useMemo(() => {
    if (!summary) return [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return summary.assets;
    return summary.assets.filter((asset) => {
      const meta = getCryptoMeta(asset.symbol);
      return asset.symbol.toLowerCase().includes(normalized) || meta.name.toLowerCase().includes(normalized);
    });
  }, [query, summary]);

  if (!summary && !error) return <div className="app-page"><div className="skeleton-card">Loading portfolio…</div></div>;

  return (
    <div className="app-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Portfolio</span>
          <h1>Your crypto positions, clearly explained.</h1>
          <p>Holdings, cost basis, market value and profit or loss in one mobile-friendly view.</p>
        </div>
        <button type="button" className="button button-dark" onClick={() => window.dispatchEvent(new Event("nextfi-open-transaction"))}>
          + Add transaction
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {summary && (
        <>
          <section className="portfolio-summary-strip panel">
            <div><span>Portfolio value</span><strong>{formatMoney(summary.totals.currentValue, summary.currency)}</strong></div>
            <div><span>Invested</span><strong>{formatMoney(summary.totals.invested, summary.currency)}</strong></div>
            <div><span>Unrealized P/L</span><strong className={summary.totals.unrealizedPnl >= 0 ? "gain" : "loss"}>{summary.totals.unrealizedPnl >= 0 ? "+" : ""}{formatMoney(summary.totals.unrealizedPnl, summary.currency)}</strong></div>
            <div><span>Total return</span><strong className={summary.totals.returnPct >= 0 ? "gain" : "loss"}>{summary.totals.returnPct >= 0 ? "+" : ""}{summary.totals.returnPct.toFixed(2)}%</strong></div>
          </section>

          <div className="portfolio-toolbar">
            <label className="portfolio-search">
              <span className="sr-only">Search portfolio</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Bitcoin, ETH, SOL…" />
            </label>
            <span className="status-pill">{assets.length} assets</span>
          </div>

          <section className="asset-card-grid">
            {assets.map((asset) => {
              const meta = getCryptoMeta(asset.symbol);
              const move = market[asset.symbol]?.change24h;
              return (
                <button type="button" className="asset-card panel" key={asset.symbol} onClick={() => setSelected(asset)}>
                  <div className="asset-card-head">
                    <CoinAvatar symbol={asset.symbol} size={46} />
                    <div>
                      <strong>{meta.name}</strong>
                      <span>{asset.symbol}</span>
                    </div>
                    <div className="asset-market-price">
                      <strong>{formatMoney(asset.currentPrice, summary.currency)}</strong>
                      {typeof move === "number" && <span className={move >= 0 ? "gain" : "loss"}>{move >= 0 ? "▲" : "▼"} {Math.abs(move).toFixed(2)}%</span>}
                    </div>
                  </div>
                  <div className="asset-card-value">
                    <span>Your value</span>
                    <strong>{formatMoney(asset.currentValue, summary.currency)}</strong>
                  </div>
                  <div className="asset-card-stats">
                    <div><span>Holdings</span><strong>{asset.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })} {asset.symbol}</strong></div>
                    <div><span>Avg. price</span><strong>{formatMoney(asset.averageEntry, summary.currency)}</strong></div>
                    <div><span>Invested</span><strong>{formatMoney(asset.remainingCostBasis, summary.currency)}</strong></div>
                    <div><span>P/L</span><strong className={asset.unrealizedPnl >= 0 ? "gain" : "loss"}>{asset.unrealizedPnl >= 0 ? "+" : ""}{formatMoney(asset.unrealizedPnl, summary.currency)}</strong></div>
                  </div>
                </button>
              );
            })}
          </section>

          {!assets.length && (
            <section className="panel empty-state">
              <h2>{query ? "No matching asset." : "Your portfolio is ready for its first entry."}</h2>
              <p>{query ? "Try a different symbol or asset name." : "Add a transaction and NextFi will calculate your position automatically."}</p>
            </section>
          )}
        </>
      )}

      {selected && summary && (
        <AppModal
          open={Boolean(selected)}
          title={getCryptoMeta(selected.symbol).name}
          eyebrow={`${selected.symbol} · Asset details`}
          description={getCryptoMeta(selected.symbol).category}
          onClose={() => setSelected(null)}
          size="lg"
          footer={
            <>
              <Link className="button button-light" href="/app/transactions" onClick={() => setSelected(null)}>View activity</Link>
              <button type="button" className="button button-dark" onClick={() => {
                const event = new CustomEvent("nextfi-open-transaction", { detail: { asset: selected.symbol } });
                window.dispatchEvent(event);
                setSelected(null);
              }}>Add {selected.symbol}</button>
            </>
          }
        >
          <div className="asset-detail">
            <div className="asset-detail-hero">
              <CoinAvatar symbol={selected.symbol} size={64} />
              <div>
                <strong>{formatMoney(selected.currentPrice, summary.currency)}</strong>
                {typeof market[selected.symbol]?.change24h === "number" && (
                  <span className={market[selected.symbol].change24h >= 0 ? "gain" : "loss"}>
                    {market[selected.symbol].change24h >= 0 ? "▲" : "▼"} {Math.abs(market[selected.symbol].change24h).toFixed(2)}% today
                  </span>
                )}
              </div>
            </div>

            <div className="asset-detail-metrics">
              <div><span>Holdings</span><strong>{selected.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })} {selected.symbol}</strong></div>
              <div><span>Current value</span><strong>{formatMoney(selected.currentValue, summary.currency)}</strong></div>
              <div><span>Average cost</span><strong>{formatMoney(selected.averageEntry, summary.currency)}</strong></div>
              <div><span>Break-even</span><strong>{formatMoney(selected.breakEven, summary.currency)}</strong></div>
              <div><span>Unrealized P/L</span><strong className={selected.unrealizedPnl >= 0 ? "gain" : "loss"}>{selected.unrealizedPnl >= 0 ? "+" : ""}{formatMoney(selected.unrealizedPnl, summary.currency)}</strong></div>
              <div><span>Return</span><strong className={selected.returnPct >= 0 ? "gain" : "loss"}>{selected.returnPct >= 0 ? "+" : ""}{selected.returnPct.toFixed(2)}%</strong></div>
            </div>

            <section className="asset-about">
              <span className="eyebrow">About {getCryptoMeta(selected.symbol).name}</span>
              <p>{getCryptoMeta(selected.symbol).about}</p>
              <div className="asset-meta-list">
                <div><span>Network</span><strong>{getCryptoMeta(selected.symbol).network}</strong></div>
                <div><span>Category</span><strong>{getCryptoMeta(selected.symbol).category}</strong></div>
              </div>
              <div className="asset-links">
                {getCryptoMeta(selected.symbol).website && <a href={getCryptoMeta(selected.symbol).website} target="_blank" rel="noopener noreferrer">Official website ↗</a>}
                {getCryptoMeta(selected.symbol).explorer && <a href={getCryptoMeta(selected.symbol).explorer} target="_blank" rel="noopener noreferrer">Explorer ↗</a>}
              </div>
            </section>
          </div>
        </AppModal>
      )}
    </div>
  );
}
