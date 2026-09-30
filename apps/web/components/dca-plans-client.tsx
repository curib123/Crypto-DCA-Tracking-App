"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiFetch, formatMoney } from "@/lib/api";
import { AlertModal, AppModal, ConfirmModal } from "@/components/ui/app-modal";
import { CoinAvatar } from "@/components/ui/coin-avatar";
import { getCryptoMeta } from "@/lib/crypto-meta";

type Frequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

type DcaPlan = {
  id: string;
  assetSymbol: string;
  amount: string | number;
  quoteCurrency: string;
  frequency: Frequency;
  startDate: string;
  enabled: boolean;
  notes?: string | null;
  createdAt: string;
};

type Draft = {
  assetSymbol: string;
  amount: string;
  quoteCurrency: string;
  frequency: Frequency;
  startDate: string;
  enabled: boolean;
  notes: string;
};

const assets = ["BTC", "ETH", "SOL", "BNB", "LINK", "HYPE", "XLM"];
const currencies = ["USD", "PHP", "EUR", "GBP", "AUD", "CAD", "SGD", "JPY", "KRW", "MYR", "IDR", "THB", "USDT", "USDC"];

function todayInput() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function nextDue(plan: DcaPlan) {
  const now = new Date();
  const due = new Date(plan.startDate);
  let guard = 0;

  while (due.getTime() < now.getTime() && guard < 600) {
    if (plan.frequency === "WEEKLY") {
      due.setDate(due.getDate() + 7);
    } else if (plan.frequency === "BIWEEKLY") {
      due.setDate(due.getDate() + 14);
    } else {
      due.setMonth(due.getMonth() + 1);
    }
    guard += 1;
  }

  return due;
}

function cadenceLabel(frequency: Frequency) {
  if (frequency === "WEEKLY") return "Every week";
  if (frequency === "BIWEEKLY") return "Every 2 weeks";
  return "Every month";
}

function monthlyEquivalent(plan: DcaPlan) {
  const amount = Number(plan.amount);
  if (plan.frequency === "WEEKLY") return amount * 52 / 12;
  if (plan.frequency === "BIWEEKLY") return amount * 26 / 12;
  return amount;
}

function blankDraft(currency = "USD"): Draft {
  return {
    assetSymbol: "BTC",
    amount: "",
    quoteCurrency: currency,
    frequency: "MONTHLY",
    startDate: todayInput(),
    enabled: true,
    notes: "",
  };
}

export function DcaPlansClient() {
  const [plans, setPlans] = useState<DcaPlan[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DcaPlan | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [deleteTarget, setDeleteTarget] = useState<DcaPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [items, settings] = await Promise.all([
        apiFetch<DcaPlan[]>("/dca-plans"),
        apiFetch<{ baseCurrency: string }>("/settings"),
      ]);
      setPlans(items);
      setBaseCurrency(settings.baseCurrency);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load DCA plans.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const activeCount = plans.filter((plan) => plan.enabled).length;
  const dueSoon = useMemo(
    () => plans.filter((plan) => plan.enabled && nextDue(plan).getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000).length,
    [plans],
  );
  const monthlyTarget = useMemo(
    () => plans
      .filter((plan) => plan.enabled && plan.quoteCurrency === baseCurrency)
      .reduce((sum, plan) => sum + monthlyEquivalent(plan), 0),
    [baseCurrency, plans],
  );

  function openCreate() {
    setEditing(null);
    setDraft(blankDraft(baseCurrency));
    setFormOpen(true);
  }

  function openEdit(plan: DcaPlan) {
    setEditing(plan);
    setDraft({
      assetSymbol: plan.assetSymbol,
      amount: String(plan.amount),
      quoteCurrency: plan.quoteCurrency,
      frequency: plan.frequency,
      startDate: new Date(plan.startDate).toISOString().slice(0, 10),
      enabled: plan.enabled,
      notes: plan.notes || "",
    });
    setFormOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const payload = {
      assetSymbol: draft.assetSymbol,
      amount: Number(draft.amount),
      quoteCurrency: draft.quoteCurrency,
      frequency: draft.frequency,
      startDate: new Date(draft.startDate + "T12:00:00").toISOString(),
      enabled: draft.enabled,
      notes: draft.notes,
    };

    try {
      if (editing) {
        await apiFetch(`/dca-plans/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        setFeedback("DCA plan updated.");
      } else {
        await apiFetch("/dca-plans", { method: "POST", body: JSON.stringify(payload) });
        setFeedback("DCA plan created. It tracks your intended cadence but never executes a trade.");
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save DCA plan.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(plan: DcaPlan) {
    setBusy(true);
    try {
      await apiFetch(`/dca-plans/${plan.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !plan.enabled }),
      });
      setFeedback(plan.enabled ? "DCA plan paused." : "DCA plan resumed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update DCA plan.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await apiFetch(`/dca-plans/${deleteTarget.id}`, { method: "DELETE" });
      setFeedback("DCA plan deleted.");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete DCA plan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">DCA plans</span>
          <h1>Plan the cadence. Record the real buy.</h1>
          <p>Set an intended contribution schedule without giving NextFi custody or trade-execution access.</p>
        </div>
        <button type="button" className="button button-dark" onClick={openCreate}>+ New plan</button>
      </div>

      <section className="dca-plan-summary">
        <article className="panel"><span>Monthly target</span><strong>{formatMoney(monthlyTarget, baseCurrency)}</strong><small>From active {baseCurrency} plans.</small></article>
        <article className="panel"><span>Active plans</span><strong>{activeCount}</strong></article>
        <article className="panel"><span>Due in 7 days</span><strong>{dueSoon}</strong></article>
      </section>

      {error && <div className="form-error dca-plan-error">{error}</div>}

      {loading && !plans.length ? (
        <div className="skeleton-card">Loading DCA plans…</div>
      ) : (
        <section className="dca-plan-grid">
          {plans.map((plan) => {
            const meta = getCryptoMeta(plan.assetSymbol);
            const due = nextDue(plan);
            return (
              <article className={`panel dca-plan-card ${plan.enabled ? "" : "paused"}`} key={plan.id}>
                <div className="dca-plan-head">
                  <CoinAvatar symbol={plan.assetSymbol} size={46} />
                  <div>
                    <strong>{meta.name}</strong>
                    <span>{plan.assetSymbol} · {cadenceLabel(plan.frequency)}</span>
                  </div>
                  <span className={`status-pill ${plan.enabled ? "" : "subtle"}`}>{plan.enabled ? "Active" : "Paused"}</span>
                </div>

                <div className="dca-plan-amount">
                  <span>Planned contribution</span>
                  <strong>{formatMoney(Number(plan.amount), plan.quoteCurrency)}</strong>
                </div>

                <div className="dca-plan-meta">
                  <div><span>Next planned date</span><strong>{due.toLocaleDateString()}</strong></div>
                  <div><span>Started</span><strong>{new Date(plan.startDate).toLocaleDateString()}</strong></div>
                </div>

                {plan.notes && <p className="dca-plan-note">{plan.notes}</p>}

                <div className="dca-plan-actions">
                  <button type="button" className="button button-dark button-small" onClick={() => {
                    window.dispatchEvent(new CustomEvent("nextfi-open-transaction", { detail: { asset: plan.assetSymbol } }));
                  }}>Record contribution</button>
                  <button type="button" className="button button-light button-small" onClick={() => openEdit(plan)}>Edit</button>
                  <button type="button" className="button button-ghost button-small" onClick={() => void toggle(plan)} disabled={busy}>{plan.enabled ? "Pause" : "Resume"}</button>
                  <button type="button" className="text-button danger-text" onClick={() => setDeleteTarget(plan)}>Delete</button>
                </div>
              </article>
            );
          })}

          {!plans.length && (
            <section className="panel empty-state dca-empty">
              <h2>No DCA plan yet.</h2>
              <p>Create a weekly, every-two-weeks, or monthly reminder plan. When you actually buy, record the transaction so portfolio accounting stays factual.</p>
              <button type="button" className="button button-dark" onClick={openCreate}>Create first plan</button>
            </section>
          )}
        </section>
      )}

      <AppModal
        open={formOpen}
        title={editing ? "Edit DCA plan" : "Create DCA plan"}
        eyebrow="Contribution schedule"
        description="This is a planning record only. NextFi will not buy crypto or move funds."
        onClose={() => setFormOpen(false)}
        size="md"
        dismissible={!busy}
      >
        <form className="modal-form" onSubmit={save}>
          <div className="asset-picker-preview">
            <CoinAvatar symbol={draft.assetSymbol} size={48} />
            <div><strong>{getCryptoMeta(draft.assetSymbol).name}</strong><span>{getCryptoMeta(draft.assetSymbol).network}</span></div>
          </div>

          <div className="modal-form-grid">
            <label className="field">
              <span>Crypto asset</span>
              <select value={draft.assetSymbol} onChange={(event) => setDraft({ ...draft, assetSymbol: event.target.value })}>
                {assets.map((asset) => <option key={asset} value={asset}>{getCryptoMeta(asset).name} ({asset})</option>)}
              </select>
            </label>
            <label className="field">
              <span>Contribution amount</span>
              <input type="number" min="0.00000001" step="any" required value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder="2000" />
            </label>
            <label className="field">
              <span>Currency</span>
              <select value={draft.quoteCurrency} onChange={(event) => setDraft({ ...draft, quoteCurrency: event.target.value })}>
                {currencies.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Cadence</span>
              <select value={draft.frequency} onChange={(event) => setDraft({ ...draft, frequency: event.target.value as Frequency })}>
                <option value="WEEKLY">Every week</option>
                <option value="BIWEEKLY">Every 2 weeks</option>
                <option value="MONTHLY">Every month</option>
              </select>
            </label>
            <label className="field field-wide">
              <span>Start date</span>
              <input type="date" required value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} />
            </label>
            <label className="field field-wide">
              <span>Notes</span>
              <textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Payday plan, long-term goal, exchange reminder…" />
            </label>
          </div>

          <label className="toggle-row">
            <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />
            <span><strong>Plan active</strong><small>Active plans show their next scheduled contribution date.</small></span>
          </label>

          <div className="modal-form-actions">
            <button type="button" className="button button-light" onClick={() => setFormOpen(false)} disabled={busy}>Cancel</button>
            <button type="submit" className="button button-dark" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create plan"}</button>
          </div>
        </form>
      </AppModal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete DCA plan?"
        description="The plan will be removed. Your existing transaction history and portfolio calculations will not be changed."
        confirmLabel="Delete plan"
        destructive
        busy={busy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
      />

      <AlertModal open={Boolean(feedback)} title="DCA plan updated" description={feedback} onClose={() => setFeedback("")} />
    </div>
  );
}
