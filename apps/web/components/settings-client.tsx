"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ThemeControl } from "@/components/theme-control";

const currencies = ["USD", "PHP", "EUR", "GBP", "AUD", "CAD", "SGD", "JPY", "KRW", "MYR", "IDR", "THB", "USDT", "USDC"];

type Settings = {
  email: string;
  baseCurrency: string;
  themePreference: "SYSTEM" | "LIGHT" | "DARK";
};

export function SettingsClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Settings>("/settings")
      .then(setSettings)
      .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load settings."));
  }, []);

  async function saveCurrency(baseCurrency: string) {
    if (!settings) return;
    setSaving(true);
    setMessage("");
    try {
      const updated = await apiFetch<Settings>("/settings", {
        method: "PATCH",
        body: JSON.stringify({ baseCurrency }),
      });
      setSettings(updated);
      setMessage("Base currency updated. Portfolio values will use it on the next refresh.");
      window.dispatchEvent(new Event("crypto-dca-data-updated"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Preferences</span>
          <h1>Settings</h1>
          <p>Keep NextFi consistent across devices while still following your system theme by default.</p>
        </div>
      </div>

      <section className="settings-grid">
        <article className="panel settings-card">
          <span className="eyebrow">Appearance</span>
          <h2>Theme</h2>
          <p>System follows your device automatically. Light and Dark override the system preference.</p>
          <ThemeControl syncAccount />
        </article>

        <article className="panel settings-card">
          <span className="eyebrow">Portfolio</span>
          <h2>Base currency</h2>
          <p>All portfolio totals are normalized to this reporting currency while original transaction currencies stay unchanged.</p>
          <label className="field">
            <span>Reporting currency</span>
            <select
              disabled={!settings || saving}
              value={settings?.baseCurrency || "USD"}
              onChange={(event) => saveCurrency(event.target.value)}
            >
              {currencies.map((currency) => <option key={currency}>{currency}</option>)}
            </select>
          </label>
        </article>

        <article className="panel settings-card">
          <span className="eyebrow">Account</span>
          <h2>Google identity</h2>
          <p>{settings?.email || "Loading account…"}</p>
          <p className="muted-copy">NextFi does not store an application password.</p>
        </article>
      </section>

      {message && <div className="inline-message">{message}</div>}
    </div>
  );
}
