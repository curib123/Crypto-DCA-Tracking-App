"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AdminCharts } from "@/components/admin-charts";

type Overview = {
  totals: {
    users: number;
    activeUsers7d: number;
    admins: number;
    suspendedUsers: number;
    transactions30d: number;
  };
  userGrowth: { date: string; value: number }[];
  transactionActivity: { date: string; value: number }[];
  topAssets: { asset: string; value: number }[];
};

export function AdminDashboardClient() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<Overview>("/admin/overview")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load admin analytics."));
  }, []);

  if (error) return <div className="app-page"><div className="form-error">{error}</div></div>;
  if (!data) return <div className="app-page"><div className="skeleton-card">Loading platform analytics…</div></div>;

  const cards = [
    ["Users", data.totals.users, "Registered accounts"],
    ["Active · 7d", data.totals.activeUsers7d, "Accounts that signed in recently"],
    ["Transactions · 30d", data.totals.transactions30d, "New ledger entries"],
    ["Suspended", data.totals.suspendedUsers, "Accounts blocked from API access"],
  ];

  return (
    <div className="app-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Control panel</span>
          <h1>Platform overview</h1>
          <p>Operational product metrics only. Charts are used where trends and distribution are easier to understand visually.</p>
        </div>
      </div>

      <section className="metric-grid admin-metrics">
        {cards.map(([label, value, description]) => (
          <article className="panel metric-card" key={String(label)}>
            <span className="metric-label">{label}</span>
            <strong>{value}</strong>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <AdminCharts
        userGrowth={data.userGrowth}
        transactionActivity={data.transactionActivity}
        topAssets={data.topAssets}
      />
    </div>
  );
}
