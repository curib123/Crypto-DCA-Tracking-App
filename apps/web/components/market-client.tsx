"use client";

import { useEffect, useState } from "react";
import { API_URL, formatMoney } from "@/lib/api";
import { cacheMarket, getCachedMarket } from "@/lib/offline";

type PriceRow = {
  symbol: string;
  price: number;
  change24h: number;
  currency: string;
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

  useEffect(() => {
    let mounted = true;

    async function load() {
      const cached = await getCachedMarket<MarketSnapshot>(currency);

      if (cached && mounted) {
        setRows(Object.values(cached.value.prices || {}));
        setSource(cached.value.source || "Cached market data");
        setUpdatedAt(cached.value.fetchedAt || cached.updatedAt);
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
          setRows(freshRows);
          setSource(data.source || "Unknown");
          setUpdatedAt(data.fetchedAt || new Date().toISOString());
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

    load();

    const onOnline = () => load();
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
          <h1>Prices for context, not impulse.</h1>
          <p>
            {offline
              ? "Showing the last synchronized market snapshot."
              : "Compare the market with your own average entry on the Overview screen."}
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
        {rows.map((row) => (
          <article className="panel market-card" key={row.symbol}>
            <div className="market-symbol">
              <span className="coin-dot">{row.symbol.slice(0, 1)}</span>
              <div>
                <strong>{row.symbol}</strong>
                <span>{row.currency}</span>
              </div>
            </div>
            <strong className="market-price">{formatMoney(row.price, row.currency)}</strong>
            <span className={row.change24h >= 0 ? "gain" : "loss"}>
              {row.change24h >= 0 ? "+" : ""}{row.change24h.toFixed(2)}% · 24h
            </span>
          </article>
        ))}
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
    </div>
  );
}
