"use client";

import { useMemo, useState } from "react";

const currencies = ["PHP", "USD", "USDT", "EUR", "GBP", "AUD", "CAD", "SGD"];

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency === "USDT" ? "USD" : currency,
      maximumFractionDigits: 0,
    }).format(value).replace("$", currency === "USDT" ? "USDT " : "$");
  } catch {
    return currency + " " + value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
}

function projectedValue(monthly: number, months: number, annualRate: number) {
  if (annualRate === 0) return monthly * months;
  const monthlyRate = annualRate / 100 / 12;
  return monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}

export function DcaCalculatorClient() {
  const [monthly, setMonthly] = useState("6000");
  const [currency, setCurrency] = useState("PHP");
  const [years, setYears] = useState("5");
  const [annualRate, setAnnualRate] = useState("0");

  const result = useMemo(() => {
    const amount = Math.max(0, Number(monthly) || 0);
    const yearCount = Math.max(1, Number(years) || 1);
    const rate = Number(annualRate) || 0;
    const months = Math.round(yearCount * 12);
    const contributions = amount * months;
    const value = projectedValue(amount, months, rate);
    return { amount, yearCount, rate, contributions, value };
  }, [annualRate, monthly, years]);

  return (
    <div className="public-calculator-grid">
      <section className="panel public-calculator-form">
        <span className="eyebrow">Your DCA plan</span>
        <h2>What if I keep investing this amount?</h2>
        <p>Use a simple contribution scenario. No account is required.</p>

        <div className="calculator-fields">
          <label className="field">
            <span>Monthly DCA</span>
            <input value={monthly} onChange={(event) => setMonthly(event.target.value)} type="number" min="0" step="any" inputMode="decimal" />
          </label>
          <label className="field">
            <span>Currency</span>
            <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
              {currencies.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Years</span>
            <select value={years} onChange={(event) => setYears(event.target.value)}>
              <option value="1">1 year</option>
              <option value="3">3 years</option>
              <option value="5">5 years</option>
              <option value="10">10 years</option>
            </select>
          </label>
          <label className="field">
            <span>Scenario annual growth</span>
            <select value={annualRate} onChange={(event) => setAnnualRate(event.target.value)}>
              <option value="0">0% — contributions only</option>
              <option value="5">5% scenario</option>
              <option value="10">10% scenario</option>
            </select>
          </label>
        </div>
      </section>

      <section className="public-calculator-result">
        <span className="eyebrow">Scenario result</span>
        <strong className="calculator-hero-value">{money(result.value, currency)}</strong>
        <p>after {result.yearCount} year{result.yearCount === 1 ? "" : "s"} at the selected scenario rate.</p>

        <div className="calculator-result-list">
          <div><span>Monthly contribution</span><strong>{money(result.amount, currency)}</strong></div>
          <div><span>Total contributed</span><strong>{money(result.contributions, currency)}</strong></div>
          <div><span>Scenario growth</span><strong>{money(Math.max(0, result.value - result.contributions), currency)}</strong></div>
        </div>

        <small>This is a mathematical scenario, not a crypto price forecast or investment recommendation.</small>
      </section>
    </div>
  );
}
