"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type AdSettings = {
  masterEnabled: boolean;
  landingEnabled: boolean;
  appEnabled: boolean;
  defaultForUsers: boolean;
};

type AdminAdsView = {
  settings: AdSettings;
  credentials: {
    clientConfigured: boolean;
    appSlotConfigured: boolean;
    landingSlotConfigured: boolean;
    clientIdMasked: string | null;
  };
  note: string;
};

export function AdminAdsClient() {
  const [data, setData] = useState<AdminAdsView | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setMessage("");
    try {
      setData(await apiFetch<AdminAdsView>("/admin/ads"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load AdSense settings.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(next: AdSettings) {
    setSaving(true);
    setMessage("");
    try {
      const updated = await apiFetch<AdminAdsView>("/admin/ads", {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setData(updated);
      setMessage("AdSense policy updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update AdSense policy.");
    } finally {
      setSaving(false);
    }
  }

  function toggle(key: keyof AdSettings) {
    if (!data) return;
    void save({
      ...data.settings,
      [key]: !data.settings[key],
    });
  }

  if (!data) {
    return (
      <div className="app-page">
        <div className="skeleton-card">Loading AdSense controls…</div>
        {message && <div className="form-error">{message}</div>}
      </div>
    );
  }

  const credentialsReady =
    data.credentials.clientConfigured &&
    data.credentials.appSlotConfigured;

  return (
    <div className="app-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Monetization setup</span>
          <h1>Google AdSense</h1>
          <p>
            Ad code is prepared but remains off until you enable it here. Credentials stay in server environment variables.
          </p>
        </div>
      </div>

      <section className="settings-grid ads-settings-grid">
        <article className="panel settings-card">
          <span className="eyebrow">Environment</span>
          <h2>AdSense credentials</h2>
          <div className="credential-list">
            <div>
              <span>Publisher client</span>
              <strong>{data.credentials.clientConfigured ? data.credentials.clientIdMasked || "Configured" : "Missing"}</strong>
            </div>
            <div>
              <span>App ad slot</span>
              <strong>{data.credentials.appSlotConfigured ? "Configured" : "Missing"}</strong>
            </div>
            <div>
              <span>Landing ad slot</span>
              <strong>{data.credentials.landingSlotConfigured ? "Configured" : "Missing"}</strong>
            </div>
          </div>
          <p className="muted-copy">{data.note}</p>
        </article>

        <article className="panel settings-card">
          <span className="eyebrow">Master switch</span>
          <h2>Ad serving</h2>
          <p>
            This overrides every other ad setting. Turning it off immediately makes NextFi stop requesting AdSense ads.
          </p>
          <button
            type="button"
            className={data.settings.masterEnabled ? "button button-dark" : "button button-light"}
            disabled={saving}
            onClick={() => toggle("masterEnabled")}
          >
            {data.settings.masterEnabled ? "Ads globally ON" : "Ads globally OFF"}
          </button>
        </article>

        <article className="panel settings-card">
          <span className="eyebrow">Signed-in users</span>
          <h2>Default audience</h2>
          <p>
            Enable for all users by default, or leave this off and enable ads only for selected accounts from User Management.
          </p>
          <button
            type="button"
            className={data.settings.defaultForUsers ? "button button-dark" : "button button-light"}
            disabled={saving}
            onClick={() => toggle("defaultForUsers")}
          >
            {data.settings.defaultForUsers ? "All inherited users ON" : "Selected users only"}
          </button>
        </article>

        <article className="panel settings-card">
          <span className="eyebrow">Application</span>
          <h2>In-app placement</h2>
          <p>
            Controls the responsive ad slot inside the authenticated NextFi PWA.
          </p>
          <button
            type="button"
            className={data.settings.appEnabled ? "button button-dark" : "button button-light"}
            disabled={saving}
            onClick={() => toggle("appEnabled")}
          >
            {data.settings.appEnabled ? "App ads ON" : "App ads OFF"}
          </button>
        </article>

        <article className="panel settings-card">
          <span className="eyebrow">Marketing site</span>
          <h2>Landing placement</h2>
          <p>
            Keeps landing-page monetization separate from signed-in user monetization.
          </p>
          <button
            type="button"
            className={data.settings.landingEnabled ? "button button-dark" : "button button-light"}
            disabled={saving}
            onClick={() => toggle("landingEnabled")}
          >
            {data.settings.landingEnabled ? "Landing ads ON" : "Landing ads OFF"}
          </button>
        </article>

        <article className="panel settings-card">
          <span className="eyebrow">Readiness</span>
          <h2>{credentialsReady ? "App ad setup ready" : "Credentials incomplete"}</h2>
          <p>
            No portfolio holdings, transactions, or AI insight text are sent to AdSense by NextFi.
          </p>
          {!credentialsReady && (
            <div className="form-error">
              Add ADSENSE_CLIENT_ID and ADSENSE_APP_SLOT_ID before enabling app ads.
            </div>
          )}
        </article>
      </section>

      <section className="panel ads-policy-note">
        <span className="eyebrow">Privacy requirement</span>
        <h2>Consent remains required where applicable</h2>
        <p>
          If you serve ads to users in the EEA, UK, or Switzerland, configure a Google-certified consent management platform in AdSense before serving personalized ads there.
        </p>
      </section>

      {message && <div className="inline-message">{message}</div>}
    </div>
  );
}
