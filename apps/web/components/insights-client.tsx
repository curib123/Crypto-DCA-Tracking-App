"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Insight = {
  id: string;
  title: string;
  body: string;
  kind: "info" | "attention" | "positive";
};

type Payload = {
  generatedAt: string;
  mode: "ai-assisted" | "analytics-only";
  provider: "mistral" | null;
  model: string | null;
  narrative: string | null;
  insights: Insight[];
  disclaimer: string;
};

export function InsightsClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await apiFetch<Payload>("/ai/insights"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate insights.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="app-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Explainable portfolio analysis</span>
          <h1>AI Insights</h1>
          <p>NextFi turns deterministic portfolio calculations into readable observations. AI never receives custody or trade execution access.</p>
        </div>
        <button type="button" className="button button-light" onClick={load} disabled={loading}>
          {loading ? "Analyzing…" : "Refresh insights"}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading && !data && <div className="skeleton-card">Analyzing your tracked portfolio…</div>}

      {data && (
        <>
          <section className="panel insight-summary">
            <div className="panel-title">
              <div>
                <span className="eyebrow">
                  Mode · {data.mode === "ai-assisted" ? `Mistral · ${data.model || "configured model"}` : "Analytics only"}
                </span>
                <h2>Portfolio summary</h2>
              </div>
              <span className="status-pill">{new Date(data.generatedAt).toLocaleString()}</span>
            </div>
            <p>{data.narrative || "Mistral is not configured or is temporarily unavailable, so NextFi is showing deterministic analytics-only observations."}</p>
          </section>

          <section className="insight-grid">
            {data.insights.map((insight) => (
              <article className={`panel insight-card ${insight.kind}`} key={insight.id}>
                <span className="eyebrow">{insight.kind === "attention" ? "Review" : "Observation"}</span>
                <h2>{insight.title}</h2>
                <p>{insight.body}</p>
              </article>
            ))}
          </section>

          <p className="data-disclaimer">{data.disclaimer}</p>
        </>
      )}
    </div>
  );
}
