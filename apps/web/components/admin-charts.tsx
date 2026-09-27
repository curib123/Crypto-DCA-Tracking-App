"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

type Point = { date: string; value: number };
type AssetPoint = { asset: string; value: number };

function useAdminChartTheme() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => setVersion((v) => v + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return useMemo(() => {
    if (typeof window === "undefined") return { text: "#111", grid: "rgba(0,0,0,.08)", primary: "#111", secondary: "#888" };
    const styles = getComputedStyle(document.documentElement);
    const dark = document.documentElement.dataset.theme === "dark";
    return {
      text: styles.getPropertyValue("--ink").trim() || (dark ? "#f5f5f5" : "#111111"),
      grid: styles.getPropertyValue("--chart-grid").trim() || (dark ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.08)"),
      primary: dark ? "#f5f5f5" : "#111111",
      secondary: dark ? "#777777" : "#999999",
    };
  }, [version]);
}

export function AdminCharts({
  userGrowth,
  transactionActivity,
  topAssets,
}: {
  userGrowth: Point[];
  transactionActivity: Point[];
  topAssets: AssetPoint[];
}) {
  const theme = useAdminChartTheme();
  const labels = userGrowth.map((point) => point.date.slice(5));

  const scales = {
    x: { ticks: { color: theme.text, maxTicksLimit: 8 }, grid: { display: false }, border: { display: false } },
    y: { ticks: { color: theme.text, precision: 0 }, grid: { color: theme.grid }, border: { display: false }, beginAtZero: true },
  };

  return (
    <section className="admin-chart-grid">
      <article className="panel chart-panel admin-wide-chart">
        <div className="panel-title"><div><span className="eyebrow">30 days</span><h2>User growth</h2></div></div>
        <div className="chart-canvas">
          <Line
            data={{
              labels,
              datasets: [{
                label: "New users",
                data: userGrowth.map((point) => point.value),
                borderColor: theme.primary,
                backgroundColor: theme.primary,
                tension: 0.35,
                pointRadius: 2,
              }],
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales }}
          />
        </div>
      </article>

      <article className="panel chart-panel">
        <div className="panel-title"><div><span className="eyebrow">30 days</span><h2>Transaction activity</h2></div></div>
        <div className="chart-canvas">
          <Bar
            data={{
              labels: transactionActivity.map((point) => point.date.slice(5)),
              datasets: [{
                label: "Transactions",
                data: transactionActivity.map((point) => point.value),
                backgroundColor: theme.primary,
                borderRadius: 5,
              }],
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales }}
          />
        </div>
      </article>

      <article className="panel chart-panel">
        <div className="panel-title"><div><span className="eyebrow">Usage</span><h2>Popular assets</h2></div></div>
        <div className="chart-canvas doughnut-canvas">
          {topAssets.length ? (
            <Doughnut
              data={{
                labels: topAssets.map((point) => point.asset),
                datasets: [{
                  data: topAssets.map((point) => point.value),
                  backgroundColor: topAssets.map((_, index) =>
                    index % 2 ? theme.secondary : theme.primary,
                  ),
                  borderWidth: 0,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: "68%",
                plugins: { legend: { labels: { color: theme.text, boxWidth: 10, usePointStyle: true } } },
              }}
            />
          ) : <div className="empty-chart">No transaction activity yet.</div>}
        </div>
      </article>
    </section>
  );
}
