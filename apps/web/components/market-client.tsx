"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL, formatMoney } from "@/lib/api";

type PriceRow = {
  symbol: string;
  price: number;
  change24h: number;
  currency: string;
};

export function MarketClient() {
  const [currency, setCurrency] = useState("USD");
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [source, setSource] = useState("Loading…");

  useEffect(() => {
    fetch(`${API_URL}/market/prices?currency=${encodeURIComponent(currency)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        setRows(Object.values(data.prices || {}));
        setSource(data.source || "Unknown");
      })
      .catch(() => {
        setRows([]);
        setSource("Unavailable");
      });
  }, [currency]);

  const updated = useMemo(() => new Date().toLocaleTimeString(), [rows]);

  return (
    <div className="app-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Market</span>
          <h1>Prices for context, not impulse.</h1>
          <p>Compare the market with your own average entry on the Overview screen.</p>
        </div>
        <label className="inline-select">
          Display
          <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {["USD","PHP","EUR","GBP","AUD","CAD","SGD","JPY","KRW","MYR","IDR","THB"].map(
              (item) => <option key={item}>{item}</option>,
            )}
          </select>
        </label>
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
          <h2>Market provider is temporarily unavailable.</h2>
          <p>Your portfolio remains usable because your ledger and cost basis do not depend on live prices.</p>
        </section>
      )}

      <p className="market-foot">Source: {source} · refreshed around {updated}</p>
    </div>
  );
}
