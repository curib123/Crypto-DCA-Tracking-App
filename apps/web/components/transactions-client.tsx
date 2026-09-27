"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch, formatMoney } from "@/lib/api";
import { pendingTransactions, queueTransaction, removePending } from "@/lib/offline";

type Transaction = {
  id: string;
  assetSymbol: string;
  type: string;
  quantity: string;
  unitPrice: string;
  amountSpent: string;
  quoteCurrency: string;
  exchange?: string | null;
  occurredAt: string;
};

const assetOptions = ["BTC", "ETH", "SOL", "BNB", "LINK", "HYPE", "XLM"];
const currencies = ["USD", "PHP", "EUR", "GBP", "AUD", "CAD", "SGD", "JPY", "KRW", "MYR", "IDR", "THB", "USDT", "USDC"];

export function TransactionsClient() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [pending, setPending] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [quoteCurrency, setQuoteCurrency] = useState("USD");

  const load = useCallback(async () => {
    try {
      const [result, user] = await Promise.all([
        apiFetch<Transaction[]>("/transactions"),
        apiFetch<{ baseCurrency: string }>("/auth/me"),
      ]);
      setRows(result);
      setBaseCurrency(user.baseCurrency);
      setQuoteCurrency((current) => current === "USD" ? user.baseCurrency : current);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load transactions.");
    }

    try {
      setPending((await pendingTransactions()).length);
    } catch {
      setPending(0);
    }
  }, []);

  const syncPending = useCallback(async () => {
    if (!navigator.onLine) return;
    const queued = await pendingTransactions();

    for (const row of queued) {
      const id = String(row._offlineId);
      const { _offlineId, _queuedAt, ...payload } = row;
      try {
        await apiFetch("/transactions", { method: "POST", body: JSON.stringify(payload) });
        await removePending(id);
      } catch {
        break;
      }
    }

    await load();
  }, [load]);

  useEffect(() => {
    load();
    syncPending();
    window.addEventListener("online", syncPending);
    return () => window.removeEventListener("online", syncPending);
  }, [load, syncPending]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      clientReference: crypto.randomUUID(),
      assetSymbol: String(data.get("assetSymbol")),
      type: String(data.get("type")),
      quantity: Number(data.get("quantity")),
      unitPrice: Number(data.get("unitPrice")),
      amountSpent: Number(data.get("amountSpent")),
      quoteCurrency,
      fxRateToBase:
        quoteCurrency === baseCurrency
          ? 1
          : Number(data.get("fxRateToBase")),
      feeBase: Number(data.get("feeBase") || 0),
      exchange: String(data.get("exchange") || ""),
      wallet: String(data.get("wallet") || ""),
      notes: String(data.get("notes") || ""),
      occurredAt: new Date(String(data.get("occurredAt"))).toISOString(),
    };

    try {
      if (!navigator.onLine) throw new Error("offline");
      await apiFetch("/transactions", { method: "POST", body: JSON.stringify(payload) });
      setMessage("Transaction saved.");
      form.reset();
      await load();
    } catch (error) {
      const isOffline = !navigator.onLine || (error instanceof Error && error.message === "offline");
      if (isOffline) {
        await queueTransaction(payload);
        setMessage("Saved offline. It will sync when your connection returns.");
        form.reset();
        await load();
      } else {
        setMessage(error instanceof Error ? error.message : "Unable to save transaction.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this transaction? Portfolio calculations will update immediately.")) return;
    await apiFetch(`/transactions/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="app-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Transaction ledger</span>
          <h1>Record the money you actually invested.</h1>
          <p>Every portfolio metric is rebuilt from this ledger.</p>
        </div>
        {pending > 0 && <span className="status-pill">Pending sync · {pending}</span>}
      </div>

      <section className="panel transaction-panel">
        <form className="transaction-form" onSubmit={submit}>
          <label>
            Asset
            <select name="assetSymbol" defaultValue="BTC">
              {assetOptions.map((asset) => <option key={asset}>{asset}</option>)}
            </select>
          </label>

          <label>
            Type
            <select name="type" defaultValue="BUY">
              {["BUY","SELL","TRANSFER_IN","TRANSFER_OUT","AIRDROP","REWARD","STAKING_REWARD","FEE","ADJUSTMENT"].map(
                (type) => <option key={type}>{type}</option>,
              )}
            </select>
          </label>

          <label>
            Money amount
            <input name="amountSpent" type="number" step="any" min="0" required placeholder="50" />
          </label>

          <label>
            Currency
            <select
              name="quoteCurrency"
              value={quoteCurrency}
              onChange={(event) => setQuoteCurrency(event.target.value)}
            >
              {currencies.map((currency) => <option key={currency}>{currency}</option>)}
            </select>
          </label>

          <label>
            Crypto quantity
            <input name="quantity" type="number" step="any" min="0" required placeholder="0.0005" />
          </label>

          <label>
            Unit price
            <input name="unitPrice" type="number" step="any" min="0" required placeholder="100000" />
          </label>

          <label>
            FX → {baseCurrency}
            <input
              name="fxRateToBase"
              type="number"
              step="any"
              min="0.00000001"
              defaultValue="1"
              disabled={quoteCurrency === baseCurrency}
              required={quoteCurrency !== baseCurrency}
              title={
                quoteCurrency === baseCurrency
                  ? "No conversion needed."
                  : `Enter how much 1 ${quoteCurrency} was worth in ${baseCurrency} at transaction time.`
              }
            />
          </label>

          <label>
            Fee in base currency
            <input name="feeBase" type="number" step="any" min="0" defaultValue="0" />
          </label>

          <label>
            Exchange
            <input name="exchange" placeholder="Optional" />
          </label>

          <label>
            Wallet
            <input name="wallet" placeholder="Optional" />
          </label>

          <label className="field-wide">
            Date
            <input
              name="occurredAt"
              type="datetime-local"
              required
              defaultValue={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
            />
          </label>

          <label className="field-wide">
            Notes
            <input name="notes" placeholder="Payday DCA, transfer note, etc." />
          </label>

          <div className="form-actions field-wide">
            <span className="form-message" aria-live="polite">{message}</span>
            <button className="button button-dark" disabled={busy}>
              {busy ? "Saving…" : "Save transaction"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">History</span>
            <h2>All transactions</h2>
          </div>
          <span className="muted">{rows.length} records</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Asset</th>
                <th>Type</th>
                <th>Actual amount</th>
                <th>Quantity</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.occurredAt).toLocaleDateString()}</td>
                  <td><strong>{row.assetSymbol}</strong></td>
                  <td><span className="status-pill subtle">{row.type}</span></td>
                  <td>{formatMoney(Number(row.amountSpent), row.quoteCurrency)}</td>
                  <td>{Number(row.quantity).toLocaleString(undefined, { maximumFractionDigits: 8 })}</td>
                  <td>{formatMoney(Number(row.unitPrice), row.quoteCurrency)}</td>
                  <td><button className="table-action" onClick={() => remove(row.id)}>Delete</button></td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="empty-cell">No transactions yet. Add your first DCA above.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
