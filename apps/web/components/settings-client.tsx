"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ThemeControl } from "@/components/theme-control";
import { AppDialog } from "@/components/ui/app-dialog";
import { useDialog } from "@/components/ui/dialog-provider";

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

type Settings = {
  email: string;
  baseCurrency: string;
  themePreference: "SYSTEM" | "LIGHT" | "DARK";
};

export function SettingsClient() {
  const { alert } = useDialog();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [draftCurrency, setDraftCurrency] = useState("USD");

  useEffect(() => {
    apiFetch<Settings>("/settings")
      .then((result) => {
        setSettings(result);
        setDraftCurrency(result.baseCurrency);
      })
      .catch((error) => {
        setLoadError(
          error instanceof Error ? error.message : "Unable to load settings.",
        );
      });
  }, []);

  function openCurrencyDialog() {
    setDraftCurrency(settings?.baseCurrency || "USD");
    setCurrencyOpen(true);
  }

  async function saveCurrency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;

    setSaving(true);

    try {
      const updated = await apiFetch<Settings>("/settings", {
        method: "PATCH",
        body: JSON.stringify({ baseCurrency: draftCurrency }),
      });

      setSettings(updated);
      setCurrencyOpen(false);
      window.dispatchEvent(new Event("crypto-dca-data-updated"));

      await alert({
        title: "Base currency updated",
        description:
          "Portfolio totals will use " +
          updated.baseCurrency +
          " the next time your data refreshes.",
        tone: "success",
      });
    } catch (error) {
      await alert({
        title: "Unable to save settings",
        description:
          error instanceof Error ? error.message : "Please try again.",
        tone: "danger",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Preferences</span>
          <h1>Make NextFi feel like your workspace.</h1>
          <p>
            Appearance, reporting currency and account identity stay simple and consistent across devices.
          </p>
        </div>
      </div>

      {loadError && <div className="form-error page-message">{loadError}</div>}

      <section className="settings-grid">
        <article className="panel settings-card">
          <div className="settings-card-icon" aria-hidden="true">Aa</div>
          <span className="eyebrow">Appearance</span>
          <h2>Theme</h2>
          <p>
            Follow your device automatically or keep NextFi locked to light or dark mode.
          </p>
          <div className="settings-card-action">
            <ThemeControl syncAccount />
          </div>
        </article>

        <article className="panel settings-card">
          <div className="settings-card-icon" aria-hidden="true">$</div>
          <span className="eyebrow">Portfolio</span>
          <h2>Base currency</h2>
          <p>
            Original transaction currencies stay unchanged while portfolio totals are normalized for reporting.
          </p>
          <div className="settings-card-value">
            <strong>{settings?.baseCurrency || "—"}</strong>
            <span>Reporting currency</span>
          </div>
          <button
            type="button"
            className="button button-light button-wide"
            onClick={openCurrencyDialog}
            disabled={!settings}
          >
            Change base currency
          </button>
        </article>

        <article className="panel settings-card">
          <div className="settings-card-icon" aria-hidden="true">@</div>
          <span className="eyebrow">Account</span>
          <h2>Google identity</h2>
          <p className="settings-email">{settings?.email || "Loading account…"}</p>
          <p className="muted-copy">
            Google is used for identity only. NextFi never stores an application password.
          </p>
        </article>
      </section>

      <AppDialog
        open={currencyOpen}
        title="Change base currency"
        eyebrow="Portfolio preference"
        description="This changes how NextFi reports totals. It does not alter the currency stored on existing transactions."
        size="sm"
        onClose={saving ? undefined : () => setCurrencyOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="button button-light"
              onClick={() => setCurrencyOpen(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="nextfi-currency-form"
              className="button button-dark"
              disabled={saving || !settings}
            >
              {saving ? "Saving…" : "Save currency"}
            </button>
          </>
        }
      >
        <form id="nextfi-currency-form" className="modal-form" onSubmit={saveCurrency}>
          <label className="field">
            Reporting currency
            <select
              value={draftCurrency}
              onChange={(event) => setDraftCurrency(event.target.value)}
              autoFocus
            >
              {currencies.map((currency) => (
                <option key={currency}>{currency}</option>
              ))}
            </select>
          </label>
        </form>
      </AppDialog>
    </div>
  );
}
