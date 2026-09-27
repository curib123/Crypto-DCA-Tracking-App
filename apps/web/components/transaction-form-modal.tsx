"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AppModal } from "@/components/ui/app-modal";
import { CoinAvatar } from "@/components/ui/coin-avatar";
import { apiFetch, formatMoney } from "@/lib/api";
import { getActiveUser, queueTransaction, setActiveUser } from "@/lib/offline";
import { getCryptoMeta } from "@/lib/crypto-meta";

const assetOptions = ["BTC", "ETH", "SOL", "BNB", "LINK", "HYPE", "XLM"];
const currencies = ["USD", "PHP", "EUR", "GBP", "AUD", "CAD", "SGD", "JPY", "KRW", "MYR", "IDR", "THB", "USDT", "USDC"];
const transactionTypes = ["BUY", "SELL", "TRANSFER_IN", "TRANSFER_OUT", "AIRDROP", "REWARD", "STAKING_REWARD", "FEE", "ADJUSTMENT"];

type UserProfile = {
  id: string;
  email: string;
  baseCurrency: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initialAsset?: string;
  onSaved?: (message: string) => void;
};

function localDateTimeNow() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function TransactionFormModal({ open, onClose, initialAsset = "BTC", onSaved }: Props) {
  const [assetSymbol, setAssetSymbol] = useState(initialAsset);
  const [type, setType] = useState("BUY");
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [quoteCurrency, setQuoteCurrency] = useState("USD");
  const [userId, setUserId] = useState("");
  const [amountSpent, setAmountSpent] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [feeBase, setFeeBase] = useState("0");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setAssetSymbol(initialAsset);
    setMessage("");

    void (async () => {
      const cached = await getActiveUser();
      if (cached) {
        setUserId(cached.id);
        setBaseCurrency(cached.baseCurrency);
        setQuoteCurrency(cached.baseCurrency);
      }
      if (!navigator.onLine) return;

      try {
        const user = await apiFetch<UserProfile>("/auth/me");
        await setActiveUser(user);
        setUserId(user.id);
        setBaseCurrency(user.baseCurrency);
        setQuoteCurrency(user.baseCurrency);
      } catch {
        // The shell owns authentication redirects. Keep cached settings when available.
      }
    })();
  }, [initialAsset, open]);

  const total = useMemo(() => {
    const amount = Number(amountSpent || 0);
    const fee = Number(feeBase || 0);
    return quoteCurrency === baseCurrency ? amount + fee : amount;
  }, [amountSpent, baseCurrency, feeBase, quoteCurrency]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      clientReference: crypto.randomUUID(),
      assetSymbol,
      type,
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      amountSpent: Number(amountSpent),
      quoteCurrency,
      fxRateToBase:
        quoteCurrency === baseCurrency
          ? 1
          : Number(data.get("fxRateToBase")),
      feeBase: Number(feeBase || 0),
      exchange: String(data.get("exchange") || ""),
      wallet: String(data.get("wallet") || ""),
      notes: String(data.get("notes") || ""),
      occurredAt: new Date(String(data.get("occurredAt"))).toISOString(),
    };

    try {
      if (!navigator.onLine) throw new Error("offline");
      await apiFetch("/transactions", { method: "POST", body: JSON.stringify(payload) });
      window.dispatchEvent(new Event("crypto-dca-data-updated"));
      onSaved?.("Transaction saved. Portfolio calculations have been refreshed.");
      onClose();
      setAmountSpent("");
      setQuantity("");
      setUnitPrice("");
      setFeeBase("0");
    } catch (error) {
      const isOffline = !navigator.onLine || (error instanceof Error && error.message === "offline");
      if (isOffline) {
        const active = await getActiveUser();
        const ownerId = userId || active?.id;
        if (!ownerId) {
          setMessage("Open NextFi online once before creating transactions offline.");
        } else {
          await queueTransaction(ownerId, payload);
          window.dispatchEvent(new Event("crypto-dca-data-updated"));
          onSaved?.("Transaction saved offline. It will sync automatically after reconnecting.");
          onClose();
        }
      } else {
        setMessage(error instanceof Error ? error.message : "Unable to save transaction.");
      }
    } finally {
      setBusy(false);
    }
  }

  const meta = getCryptoMeta(assetSymbol);

  return (
    <AppModal
      open={open}
      title="Add transaction"
      eyebrow="Portfolio activity"
      description="Record a buy, sell, transfer or reward. NextFi rebuilds cost basis from the ledger."
      onClose={onClose}
      size="lg"
      dismissible={!busy}
    >
      <form className="modal-form transaction-modal-form" onSubmit={submit}>
        <div className="asset-picker-preview">
          <CoinAvatar symbol={assetSymbol} size={48} />
          <div>
            <strong>{meta.name}</strong>
            <span>{assetSymbol} · {meta.network}</span>
          </div>
        </div>

        <label className="field">
          <span>Crypto asset</span>
          <select value={assetSymbol} onChange={(event) => setAssetSymbol(event.target.value)}>
            {assetOptions.map((asset) => {
              const item = getCryptoMeta(asset);
              return <option key={asset} value={asset}>{item.name} ({asset})</option>;
            })}
          </select>
        </label>

        <fieldset className="transaction-type-field">
          <legend>Transaction type</legend>
          <div className="segment-control">
            {transactionTypes.map((item) => (
              <button
                key={item}
                type="button"
                className={type === item ? "active" : undefined}
                onClick={() => setType(item)}
              >
                {item.replaceAll("_", " ")}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="modal-form-grid">
          <label className="field">
            <span>Money amount</span>
            <input value={amountSpent} onChange={(event) => setAmountSpent(event.target.value)} type="number" step="any" min="0" required placeholder="50" />
          </label>
          <label className="field">
            <span>Currency</span>
            <select value={quoteCurrency} onChange={(event) => setQuoteCurrency(event.target.value)}>
              {currencies.map((currency) => <option key={currency}>{currency}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Crypto quantity</span>
            <input value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" step="any" min="0" required placeholder="0.0005" />
          </label>
          <label className="field">
            <span>Unit price</span>
            <input value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} type="number" step="any" min="0" required placeholder="100000" />
          </label>
          <label className="field">
            <span>FX → {baseCurrency}</span>
            <input
              name="fxRateToBase"
              type="number"
              step="any"
              min="0.00000001"
              defaultValue="1"
              disabled={quoteCurrency === baseCurrency}
              required={quoteCurrency !== baseCurrency}
            />
          </label>
          <label className="field">
            <span>Fee in {baseCurrency}</span>
            <input value={feeBase} onChange={(event) => setFeeBase(event.target.value)} type="number" step="any" min="0" />
          </label>
          <label className="field">
            <span>Exchange</span>
            <input name="exchange" placeholder="Optional" />
          </label>
          <label className="field">
            <span>Wallet</span>
            <input name="wallet" placeholder="Optional" />
          </label>
          <label className="field field-wide">
            <span>Date and time</span>
            <input name="occurredAt" type="datetime-local" required defaultValue={localDateTimeNow()} />
          </label>
          <label className="field field-wide">
            <span>Notes</span>
            <textarea name="notes" placeholder="Payday DCA, transfer note, strategy note…" />
          </label>
        </div>

        <div className="transaction-preview">
          <div><span>Asset</span><strong>{quantity || "0"} {assetSymbol}</strong></div>
          <div><span>Transaction value</span><strong>{formatMoney(Number(amountSpent || 0), quoteCurrency)}</strong></div>
          <div><span>Fee</span><strong>{formatMoney(Number(feeBase || 0), baseCurrency)}</strong></div>
          <div><span>{quoteCurrency === baseCurrency ? "Total" : "Amount before FX"}</span><strong>{formatMoney(total, quoteCurrency)}</strong></div>
        </div>

        {message && <div className="form-error" role="alert">{message}</div>}

        <div className="modal-form-actions">
          <button type="button" className="button button-light" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="button button-dark" disabled={busy}>
            {busy ? "Saving…" : navigator.onLine ? "Save transaction" : "Save offline"}
          </button>
        </div>
      </form>
    </AppModal>
  );
}
