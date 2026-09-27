"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatMoney, isNetworkFailure } from "@/lib/api";
import { AlertModal, ConfirmModal } from "@/components/ui/app-modal";
import { CoinAvatar } from "@/components/ui/coin-avatar";
import { TransactionFormModal } from "@/components/transaction-form-modal";
import { getCryptoMeta } from "@/lib/crypto-meta";
import {
  cacheUserResource,
  getActiveUser,
  getCachedUserResource,
  pendingTransactions,
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
  const [rows, setRows] = useState<Transaction[]>([]);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  const load = useCallback(async () => {
    const activeUser = await getActiveUser();

    if (activeUser) {
      const [cached, queued] = await Promise.all([
        getCachedUserResource<Transaction[]>(activeUser.id, "transactions"),
        pendingTransactions(activeUser.id),
      ]);

      setRows(cached ? mergeRows(cached.value, queued) : mergeRows([], queued));
      setCachedAt(cached?.updatedAt || null);
      setPending(queued.length);
    }

    if (!navigator.onLine) {
      setOffline(true);
      if (!activeUser) setError("No signed-in offline profile is available on this device.");
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

      setRows(mergeRows(result, queued));
      setPending(queued.length);
      setCachedAt(new Date().toISOString());
      setOffline(false);
      setError("");
    } catch (err) {
      setOffline(isNetworkFailure(err) || !navigator.onLine);
      if (!activeUser) setError(err instanceof Error ? err.message : "Unable to load transactions.");
    }
  }, []);

  useEffect(() => {
    void load();

    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "add") {
      setTransactionOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }

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

  async function remove() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setError("");

    try {
      if (deleteTarget.pending) {
        await removePending(deleteTarget.id);
        setFeedback("Pending offline transaction removed.");
      } else {
        if (!navigator.onLine) {
          setError("Reconnect before deleting a synchronized transaction.");
          return;
        }
        await apiFetch(`/transactions/${deleteTarget.id}`, { method: "DELETE" });
        setFeedback("Transaction deleted. Portfolio calculations were refreshed.");
      }
      setDeleteTarget(null);
      window.dispatchEvent(new Event("crypto-dca-data-updated"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete transaction.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="app-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Activity</span>
          <h1>Your crypto ledger.</h1>
          <p>Every DCA, transfer and adjustment stays traceable. Portfolio values are rebuilt from these records.</p>
        </div>
        <button type="button" className="button button-dark" onClick={() => setTransactionOpen(true)}>+ Add transaction</button>
      </div>

      <div className="activity-status-row">
        {offline && <span className="status-pill">Offline · cached {cachedAt ? new Date(cachedAt).toLocaleString() : "locally"}</span>}
        {pending > 0 && <span className="status-pill">Pending sync · {pending}</span>}
        <span className="status-pill">{rows.length} records</span>
      </div>

      {error && <div className="form-error activity-error">{error}</div>}

      <section className="panel activity-panel">
        <div className="panel-title">
          <div><span className="eyebrow">History</span><h2>{offline ? "Cached + pending activity" : "All activity"}</h2></div>
        </div>

        <div className="activity-list">
          {rows.map((row) => {
            const meta = getCryptoMeta(row.assetSymbol);
            return (
              <article className="activity-item" key={row.id}>
                <CoinAvatar symbol={row.assetSymbol} size={42} />
                <div className="activity-main">
                  <div>
                    <strong>{meta.name}</strong>
                    <span>{row.type.replaceAll("_", " ")}{row.exchange ? ` · ${row.exchange}` : ""}</span>
                  </div>
                  <small>{new Date(row.occurredAt).toLocaleString()}</small>
                </div>
                <div className="activity-amount">
                  <strong>{formatMoney(Number(row.amountSpent), row.quoteCurrency)}</strong>
                  <span>{Number(row.quantity).toLocaleString(undefined, { maximumFractionDigits: 8 })} {row.assetSymbol}</span>
                  {row.pending && <em>Pending sync</em>}
                </div>
                <button type="button" className="activity-more danger-text" onClick={() => setDeleteTarget(row)} aria-label={`Delete ${row.assetSymbol} transaction`}>Delete</button>
              </article>
            );
          })}
          {!rows.length && (
            <div className="empty-state">
              <h2>No activity yet.</h2>
              <p>Record your first DCA contribution to start building your portfolio history.</p>
              <button type="button" className="button button-dark" onClick={() => setTransactionOpen(true)}>Add transaction</button>
            </div>
          )}
        </div>
      </section>

      <TransactionFormModal
        open={transactionOpen}
        onClose={() => setTransactionOpen(false)}
        onSaved={(message) => {
          setFeedback(message);
          void load();
        }}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={deleteTarget?.pending ? "Remove pending transaction?" : "Delete this transaction?"}
        description={deleteTarget?.pending
          ? "This offline record has not synchronized yet. Removing it permanently clears it from this device."
          : "Portfolio cost basis and profit/loss will update immediately after deletion."}
        confirmLabel={deleteTarget?.pending ? "Remove" : "Delete"}
        destructive
        busy={deleteBusy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
      />

      <AlertModal open={Boolean(feedback)} title="Activity updated" description={feedback} onClose={() => setFeedback("")} />
    </div>
  );
}
