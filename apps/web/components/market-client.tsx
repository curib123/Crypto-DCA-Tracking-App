"use client";

import { useEffect, useState } from "react";
import { API_URL, formatMoney } from "@/lib/api";
import { cacheMarket, getCachedMarket } from "@/lib/offline";
import { CoinAvatar } from "@/components/ui/coin-avatar";
import { AppModal } from "@/components/ui/app-modal";
import { getCryptoMeta } from "@/lib/crypto-meta";

type PriceRow = {
  symbol: string;
  price: number;
  change24h: number;
  currency: string;
  lastUpdatedAt?: number;
};

type MarketSnapshot = {
  source: string;
  prices: Record<string, PriceRow>;
  fetchedAt: string;
};

export function MarketClient() {
  const [currency, setCurrency] = useState("USD");
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [source, setSource] = useState("Loading…");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [selected, setSelected] = useState<PriceRow | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const cached = await getCachedMarket<MarketSnapshot>(currency);

      if (cached && mounted) {
        const cachedRows = Object.values(cached.value.prices || {});
        const providerTimestamp = Math.max(0, ...cachedRows.map((row) => Number(row.lastUpdatedAt || 0)));
        setRows(cachedRows);
        setSource(cached.value.source || "Cached market data");
        setUpdatedAt(
          providerTimestamp > 0
            ? new Date(providerTimestamp * 1000).toISOString()
            : cached.value.fetchedAt || cached.updatedAt,
        );
        setOffline(!navigator.onLine);
      }

      if (!navigator.onLine) {
        if (mounted) setOffline(true);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/market/prices?currency=${encodeURIComponent(currency)}`,
          { cache: "no-store", credentials: "include" },
        );

        if (!response.ok) throw new Error("Market request failed");

        const data = (await response.json()) as MarketSnapshot;
        const freshRows = Object.values(data.prices || {});

        if (!freshRows.length) {
          if (mounted) {
            setOffline(Boolean(cached));
            if (!cached) {
              setRows([]);
              setSource(data.source || "Unavailable");
              setUpdatedAt(data.fetchedAt || null);
            }
          }
          return;
        }

        await cacheMarket(currency, data);

        if (mounted) {
          const providerTimestamp = Math.max(0, ...freshRows.map((row) => Number(row.lastUpdatedAt || 0)));
          setRows(freshRows);
          setSource(data.source || "Unknown");
          setUpdatedAt(
            providerTimestamp > 0
              ? new Date(providerTimestamp * 1000).toISOString()
              : data.fetchedAt || new Date().toISOString(),
          );
          setOffline(false);
        }
      } catch {
        if (mounted) {
          setOffline(true);
          if (!cached) {
            setRows([]);
            setSource("Unavailable");
            setUpdatedAt(null);
          }
        }
      }
    }

    void load();

    const onOnline = () => void load();
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      mounted = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [currency]);

  return (
    <div className="app-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Market</span>
          <h1>Market context without the noise.</h1>
          <p>
            {offline
              ? "Showing the last synchronized market snapshot."
              : "Use current prices as context beside your real cost basis and DCA history."}
          </p>
        </div>
        <div className="heading-statuses">
          {offline && <span className="status-pill">Offline · stale prices</span>}
          <label className="inline-select">
            Display
            <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
              {["USD","PHP","EUR","GBP","AUD","CAD","SGD","JPY","KRW","MYR","IDR","THB"].map(
                (item) => <option key={item}>{item}</option>,
              )}
            </select>
          </label>
        </div>
      </div>

      <section className="market-grid">
        {rows.map((row) => {
          const meta = getCryptoMeta(row.symbol);
          return (
            <button type="button" className="panel market-card market-card-button" key={row.symbol} onClick={() => setSelected(row)}>
              <div className="market-symbol">
                <CoinAvatar symbol={row.symbol} size={42} />
                <div>
                  <strong>{meta.name}</strong>
                  <span>{row.symbol} · {row.currency}</span>
                </div>
              </div>
              <strong className="market-price">{formatMoney(row.price, row.currency)}</strong>
              <span className={row.change24h >= 0 ? "gain" : "loss"}>
                {row.change24h >= 0 ? "▲" : "▼"} {Math.abs(row.change24h).toFixed(2)}% · 24h
              </span>
            </button>
          );
        })}
      </section>

      {!rows.length && (
        <section className="panel empty-state">
          <h2>No synchronized market snapshot is available yet.</h2>
          <p>Open Market once while online, then the last snapshot will remain readable offline.</p>
        </section>
      )}

      <p className="market-foot">
        Source: <a href="https://www.coingecko.com/" target="_blank" rel="noopener noreferrer">{source}</a>
        {updatedAt ? ` · last updated ${new Date(updatedAt).toLocaleString()}` : ""}
        {offline ? " · offline" : ""}
      </p>

      {selected && (
        <AppModal
          open={Boolean(selected)}
          title={getCryptoMeta(selected.symbol).name}
          eyebrow={`${selected.symbol} · Market information`}
          description={getCryptoMeta(selected.symbol).category}
          onClose={() => setSelected(null)}
          size="md"
          footer={
            <button type="button" className="button button-dark" onClick={() => {
              window.dispatchEvent(new CustomEvent("nextfi-open-transaction", { detail: { asset: selected.symbol } }));
              setSelected(null);
            }}>
              Add {selected.symbol} transaction
            </button>
          }
        >
          <div className="market-detail">
            <div className="asset-detail-hero">
              <CoinAvatar symbol={selected.symbol} size={64} />
              <div>
                <strong>{formatMoney(selected.price, selected.currency)}</strong>
                <span className={selected.change24h >= 0 ? "gain" : "loss"}>
                  {selected.change24h >= 0 ? "▲" : "▼"} {Math.abs(selected.change24h).toFixed(2)}% in 24h
                </span>
              </div>
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
