"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import { AlertModal, AppModal } from "@/components/ui/app-modal";

const currencies = ["USD", "PHP", "EUR", "GBP", "AUD", "CAD", "SGD", "JPY", "KRW", "MYR", "IDR", "THB", "USDT", "USDC"];

type Settings = {
  email: string;
  baseCurrency: string;
};

export function SettingsClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [draftCurrency, setDraftCurrency] = useState("USD");
  const [alertOpen, setAlertOpen] = useState(false);

  useEffect(() => {
    apiFetch<Settings>("/settings")
      .then((next) => {
        setSettings(next);
        setDraftCurrency(next.baseCurrency);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load settings."));
  }, []);

  async function saveCurrency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage("");

    try {
      const updated = await apiFetch<Settings>("/settings", {
        method: "PATCH",
        body: JSON.stringify({ baseCurrency: draftCurrency }),
      });
      setSettings(updated);
      setCurrencyOpen(false);
      setMessage("Base currency updated. Portfolio values will use it on the next refresh.");
      setAlertOpen(true);
      window.dispatchEvent(new Event("crypto-dca-data-updated"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  const initials = settings?.email?.slice(0, 1).toUpperCase() || "N";

  return (
    <div className="app-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Profile & settings</span>
          <h1>Your NextFi account.</h1>
          <p>Manage your identity, reporting currency and app preferences without clutter.</p>
        </div>
      </div>

      {message && !alertOpen && <div className="inline-message settings-message">{message}</div>}

      <section className="profile-card panel">
        <span className="account-avatar profile-avatar">{initials}</span>
        <div className="profile-card-copy">
          <span className="eyebrow">Google identity</span>
          <h2>{settings?.email || "Loading account…"}</h2>
          <p>Signed in securely with Google. NextFi does not keep a separate application password.</p>
        </div>
        <span className="status-pill">Active</span>
      </section>

      <section className="settings-list panel">
        <button type="button" className="settings-list-item settings-button" onClick={() => {
          setDraftCurrency(settings?.baseCurrency || "USD");
          setCurrencyOpen(true);
        }}>
          <div className="settings-icon">¤</div>
          <div><strong>Base currency</strong><span>Portfolio values are normalized to your reporting currency.</span></div>
          <span className="settings-value">{settings?.baseCurrency || "USD"} ›</span>
        </button>

        <button type="button" className="settings-list-item settings-button" onClick={() => {
          if (typeof window !== "undefined") window.dispatchEvent(new Event("nextfi-open-transaction"));
        }}>
          <div className="settings-icon">＋</div>
          <div><strong>Quick transaction</strong><span>Open the centralized transaction form.</span></div>
          <span className="settings-value">Open ›</span>
        </button>
      </section>

      <section className="settings-list panel">
        <a className="settings-list-item" href="/" target="_self">
          <div className="settings-icon">i</div>
          <div><strong>About NextFi</strong><span>Crypto DCA tracking, cost basis and portfolio analytics.</span></div>
          <span className="settings-value">›</span>
        </a>
        <a className="settings-list-item" href="/app/help">
          <div className="settings-icon">?</div>
          <div><strong>Help & feedback</strong><span>Common questions, offline behavior and bug reporting.</span></div>
          <span className="settings-value">›</span>
        </a>
        <a className="settings-list-item" href="/privacy">
          <div className="settings-icon">⌁</div>
          <div><strong>Privacy</strong><span>How account and portfolio data are handled.</span></div>
          <span className="settings-value">›</span>
        </a>
        <a className="settings-list-item" href="/terms">
          <div className="settings-icon">§</div>
          <div><strong>Terms</strong><span>Product terms and important limitations.</span></div>
          <span className="settings-value">›</span>
        </a>
      </section>

      <section className="danger-zone panel">
        <div><span className="eyebrow">Account</span><h2>Sign out</h2><p>End this session and clear cached user data from this device.</p></div>
        <button type="button" className="button button-danger" onClick={() => window.dispatchEvent(new Event("nextfi-request-logout"))}>Log out</button>
      </section>

      <AppModal
        open={currencyOpen}
        title="Change base currency"
        eyebrow="Portfolio settings"
        description="This changes how NextFi reports portfolio totals. Original transaction currencies remain unchanged."
        onClose={() => setCurrencyOpen(false)}
        size="sm"
      >
        <form className="modal-form" onSubmit={saveCurrency}>
          <label className="field">
            <span>Reporting currency</span>
            <select value={draftCurrency} onChange={(event) => setDraftCurrency(event.target.value)} disabled={saving}>
              {currencies.map((currency) => <option key={currency}>{currency}</option>)}
            </select>
          </label>
          <div className="modal-form-actions">
            <button type="button" className="button button-light" onClick={() => setCurrencyOpen(false)} disabled={saving}>Cancel</button>
            <button type="submit" className="button button-dark" disabled={saving}>{saving ? "Saving…" : "Save currency"}</button>
          </div>
        </form>
      </AppModal>

      <AlertModal open={alertOpen} title="Currency updated" description={message} onClose={() => setAlertOpen(false)} />
    </div>
  );
}
