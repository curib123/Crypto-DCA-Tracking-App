"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch, formatMoney, isNetworkFailure } from "@/lib/api";
import { AppDialog } from "@/components/ui/app-dialog";
import { useDialog } from "@/components/ui/dialog-provider";
import {
  cacheUserResource,
  getActiveUser,
  getCachedUserResource,
  pendingTransactions,
  queueTransaction,
  removePending,
  setActiveUser,
} from "@/lib/offline";

type Transaction = {
  id: string;
  assetSymbol: string;
  type: string;
  quantity: string | number;
  unitPrice: string | number;
  amountSpent: string | number;
  quoteCurrency: string;
  exchange?: string | null;
  occurredAt: string;
  pending?: boolean;
};

type UserProfile = {
  id: string;
  email: string;
  baseCurrency: string;
};

const assetOptions = ["BTC", "ETH", "SOL", "BNB", "LINK", "HYPE", "XLM"];
const transactionTypes = [
  "BUY",
  "SELL",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "AIRDROP",
  "REWARD",
  "STAKING_REWARD",
  "FEE",
  "ADJUSTMENT",
];
const currencies = [
  "USD",
  "PHP",
  "EUR",
  "GBP",
  "AUD",
  "CAD",
  "SGD",
  "JPY",
  "KRW",
  "MYR",
  "IDR",
  "THB",
  "USDT",
  "USDC",
];

function queuedAsTransactions(rows: Record<string, unknown>[]): Transaction[] {
  return rows.map((row) => ({
    id: String(row._offlineId),
    assetSymbol: String(row.assetSymbol || ""),
    type: String(row.type || ""),
    quantity: Number(row.quantity || 0),
    unitPrice: Number(row.unitPrice || 0),
    amountSpent: Number(row.amountSpent || 0),
    quoteCurrency: String(row.quoteCurrency || ""),
    exchange: row.exchange ? String(row.exchange) : null,
    occurredAt: String(row.occurredAt || row._queuedAt || new Date().toISOString()),
    pending: true,
  }));
}

function mergeRows(serverRows: Transaction[], queuedRows: Record<string, unknown>[]) {
  return [...queuedAsTransactions(queuedRows), ...serverRows].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

export function TransactionsClient() {
  const { alert, confirm } = useDialog();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [pending, setPending] = useState(0);
  const [loadMessage, setLoadMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [quoteCurrency, setQuoteCurrency] = useState("USD");
  const [userId, setUserId] = useState("");
  const [offline, setOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    const activeUser = await getActiveUser();

    if (activeUser) {
      setUserId(activeUser.id);
      setBaseCurrency(activeUser.baseCurrency);
      setQuoteCurrency((current) =>
        current === "USD" ? activeUser.baseCurrency : current,
      );

      const [cached, queued] = await Promise.all([
        getCachedUserResource<Transaction[]>(activeUser.id, "transactions"),
        pendingTransactions(activeUser.id),
      ]);

      if (cached) {
        setRows(mergeRows(cached.value, queued));
        setCachedAt(cached.updatedAt);
      } else {
        setRows(mergeRows([], queued));
      }

      setPending(queued.length);
    }

    if (!navigator.onLine) {
      setOffline(true);
      if (!activeUser) {
        setLoadMessage("No signed-in offline profile is available on this device.");
      }
      return;
    }

    try {
      const [result, user] = await Promise.all([
        apiFetch<Transaction[]>("/transactions"),
        apiFetch<UserProfile>("/auth/me"),
      ]);

      await setActiveUser(user);
      await cacheUserResource(user.id, "transactions", result);
      const queued = await pendingTransactions(user.id);

      setUserId(user.id);
      setRows(mergeRows(result, queued));
      setPending(queued.length);
      setBaseCurrency(user.baseCurrency);
      setQuoteCurrency((current) =>
        current === "USD" ? user.baseCurrency : current,
      );
      setCachedAt(new Date().toISOString());
      setOffline(false);
      setLoadMessage("");
    } catch (error) {
      setOffline(isNetworkFailure(error) || !navigator.onLine);

      if (!activeUser) {
        setLoadMessage(
          error instanceof Error ? error.message : "Unable to load transactions.",
        );
      }
    }
  }, []);

  useEffect(() => {
    void load();

    const onOnline = () => {
      setOffline(false);
      void load();
    };
    const onOffline = () => setOffline(true);
    const onDataUpdated = () => void load();

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("crypto-dca-data-updated", onDataUpdated);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("crypto-dca-data-updated", onDataUpdated);
    };
  }, [load]);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);

    if (search.get("new") === "1") {
      setFormOpen(true);
      window.history.replaceState({}, "", "/app/transactions");
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);

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
        quoteCurrency === baseCurrency ? 1 : Number(data.get("fxRateToBase")),
      feeBase: Number(data.get("feeBase") || 0),
      exchange: String(data.get("exchange") || ""),
      wallet: String(data.get("wallet") || ""),
      notes: String(data.get("notes") || ""),
      occurredAt: new Date(String(data.get("occurredAt"))).toISOString(),
    };

    try {
      if (!navigator.onLine) throw new Error("offline");

      await apiFetch("/transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      form.reset();
      setQuoteCurrency(baseCurrency);
      setFormOpen(false);
      await load();
      await alert({
        title: "Transaction saved",
        description: "Your ledger and portfolio calculations have been updated.",
        tone: "success",
      });
    } catch (error) {
      const isOffline =
        !navigator.onLine ||
        (error instanceof Error && error.message === "offline");

      if (isOffline) {
        const activeUser = await getActiveUser();
        const ownerId = userId || activeUser?.id;

        if (!ownerId) {
          await alert({
            title: "Offline profile unavailable",
            description:
              "Open NextFi online once before creating transactions offline.",
            tone: "danger",
          });
        } else {
          await queueTransaction(ownerId, payload);
          form.reset();
          setQuoteCurrency(baseCurrency);
          setFormOpen(false);
          await load();
          await alert({
            title: "Saved for sync",
            description:
              "The transaction is stored on this device and will sync automatically when your connection returns.",
            tone: "success",
          });
        }
      } else {
        await alert({
          title: "Unable to save transaction",
          description:
            error instanceof Error ? error.message : "Please try again.",
          tone: "danger",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: Transaction) {
    if (row.pending) {
      const approved = await confirm({
        title: "Remove pending transaction?",
        description:
          "This offline transaction has not been synchronized yet and will be permanently removed from this device.",
        confirmLabel: "Remove",
        tone: "danger",
      });

      if (!approved) return;

      await removePending(row.id);
      await load();
      await alert({
        title: "Pending transaction removed",
        description: "The queued transaction will no longer be synchronized.",
      });
      return;
    }

    if (!navigator.onLine) {
      await alert({
        title: "Reconnect to delete",
        description:
          "Synchronized transactions can only be deleted while NextFi is online.",
      });
      return;
    }

    const approved = await confirm({
      title: "Delete this transaction?",
      description:
        "This permanently removes the ledger entry and immediately recalculates your portfolio.",
      confirmLabel: "Delete transaction",
      tone: "danger",
    });

    if (!approved) return;

    try {
      await apiFetch("/transactions/" + row.id, { method: "DELETE" });
      await load();
      window.dispatchEvent(new Event("crypto-dca-data-updated"));
      await alert({
        title: "Transaction deleted",
        description: "Your portfolio calculations have been refreshed.",
        tone: "success",
      });
    } catch (error) {
      await alert({
        title: "Unable to delete transaction",
        description:
          error instanceof Error ? error.message : "Please try again.",
        tone: "danger",
      });
    }
  }

  return (
    <div className="app-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Transaction ledger</span>
          <h1>Every contribution, in one clean ledger.</h1>
          <p>
            Add buys, sells, transfers and rewards. NextFi rebuilds your cost basis from these records.
          </p>
        </div>

        <div className="heading-actions">
          <div className="heading-statuses">
            {offline && (
              <span className="status-pill">
                Offline · cached{" "}
                {cachedAt ? new Date(cachedAt).toLocaleString() : "locally"}
              </span>
            )}
            {pending > 0 && (
              <span className="status-pill">Pending sync · {pending}</span>
            )}
          </div>
          <button
            type="button"
            className="button button-dark"
            onClick={() => setFormOpen(true)}
          >
            + Add transaction
          </button>
        </div>
      </div>

      {loadMessage && <div className="form-error page-message">{loadMessage}</div>}

      <section className="panel ledger-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">History</span>
            <h2>{offline ? "Cached + pending transactions" : "All transactions"}</h2>
          </div>
          <span className="muted">{rows.length} records</span>
        </div>

        <div className="table-wrap transaction-table-wrap">
          <table className="transaction-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Asset</th>
                <th>Type</th>
                <th>Actual amount</th>
                <th>Quantity</th>
                <th>Price</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td data-label="Date">
                    {new Date(row.occurredAt).toLocaleDateString()}
                  </td>
                  <td data-label="Asset">
                    <strong>{row.assetSymbol}</strong>
                  </td>
                  <td data-label="Type">
                    <span className="status-pill subtle">
                      {row.type}
                      {row.pending ? " · PENDING" : ""}
                    </span>
                  </td>
                  <td data-label="Amount">
                    {formatMoney(Number(row.amountSpent), row.quoteCurrency)}
                  </td>
                  <td data-label="Quantity">
                    {Number(row.quantity).toLocaleString(undefined, {
                      maximumFractionDigits: 8,
                    })}
                  </td>
                  <td data-label="Price">
                    {formatMoney(Number(row.unitPrice), row.quoteCurrency)}
                  </td>
                  <td data-label="Action" className="transaction-row-action">
                    <button
                      type="button"
                      className="table-action"
                      onClick={() => void remove(row)}
                    >
                      {row.pending ? "Remove" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}

              {!rows.length && (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    No transactions yet. Use Add transaction to record your first DCA.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <AppDialog
        open={formOpen}
        title="Add transaction"
        eyebrow="Ledger entry"
        description={
          offline
            ? "You are offline. This entry will be stored securely on this device and synchronized later."
            : "Record the actual values from your exchange or wallet."
        }
        size="lg"
        onClose={busy ? undefined : () => setFormOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="button button-light"
              onClick={() => setFormOpen(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="nextfi-transaction-form"
              className="button button-dark"
              disabled={busy}
            >
              {busy ? "Saving…" : offline ? "Save offline" : "Save transaction"}
            </button>
          </>
        }
      >
        <form
          id="nextfi-transaction-form"
          className="transaction-form transaction-modal-form"
          onSubmit={submit}
        >
          <label>
            Asset
            <select name="assetSymbol" defaultValue="BTC">
              {assetOptions.map((asset) => (
                <option key={asset}>{asset}</option>
              ))}
            </select>
          </label>

          <label>
            Type
            <select name="type" defaultValue="BUY">
              {transactionTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>

          <label>
            Money amount
            <input
              name="amountSpent"
              type="number"
              step="any"
              min="0"
              required
              placeholder="50"
            />
          </label>

          <label>
            Currency
            <select
              name="quoteCurrency"
              value={quoteCurrency}
              onChange={(event) => setQuoteCurrency(event.target.value)}
            >
              {currencies.map((currency) => (
                <option key={currency}>{currency}</option>
              ))}
            </select>
          </label>

          <label>
            Crypto quantity
            <input
              name="quantity"
              type="number"
              step="any"
              min="0"
              required
              placeholder="0.0005"
            />
          </label>

          <label>
            Unit price
            <input
              name="unitPrice"
              type="number"
              step="any"
              min="0"
              required
              placeholder="100000"
            />
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
                  : "Enter how much 1 " +
                    quoteCurrency +
                    " was worth in " +
                    baseCurrency +
                    " at transaction time."
              }
            />
          </label>

          <label>
            Fee in {baseCurrency}
            <input
              name="feeBase"
              type="number"
              step="any"
              min="0"
              defaultValue="0"
            />
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
              defaultValue={new Date(
                Date.now() - new Date().getTimezoneOffset() * 60000,
              )
                .toISOString()
                .slice(0, 16)}
            />
          </label>

          <label className="field-wide">
            Notes
            <textarea
              name="notes"
              placeholder="Payday DCA, transfer note, strategy context…"
            />
          </label>
        </form>
      </AppDialog>
    </div>
  );
}
