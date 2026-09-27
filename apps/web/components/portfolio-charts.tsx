"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

type Asset = {
  symbol: string;
  currentValue: number;
  remainingCostBasis: number;
};

function useChartTheme() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const observer = new MutationObserver(() => setTick((value) => value + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return useMemo(() => {
    if (typeof window === "undefined") {
      return { text: "#111111", grid: "rgba(0,0,0,.08)", palette: ["#111111", "#3f3f3f", "#6b6b6b", "#929292", "#b9b9b9", "#d5d5d5"] };
    }
    const styles = getComputedStyle(document.documentElement);
    const dark = document.documentElement.dataset.theme === "dark";
    return {
      text: styles.getPropertyValue("--ink").trim() || (dark ? "#f5f5f5" : "#111111"),
      grid: styles.getPropertyValue("--chart-grid").trim() || (dark ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.08)"),
      palette: dark
        ? ["#f5f5f5", "#d6d6d6", "#b8b8b8", "#969696", "#777777", "#5f5f5f"]
        : ["#111111", "#3f3f3f", "#666666", "#8a8a8a", "#adadad", "#d0d0d0"],
    };
  }, [tick]);
}

export function PortfolioCharts({
  assets,
  currency,
}: {
  assets: Asset[];
  currency: string;
}) {
  const theme = useChartTheme();
  const visible = assets.filter((asset) => asset.currentValue > 0).slice(0, 8);

  const format = (value: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);

  if (!visible.length) return null;

  const allocation = {
    labels: visible.map((asset) => asset.symbol),
    datasets: [{
      data: visible.map((asset) => asset.currentValue),
      backgroundColor: visible.map((_, index) => theme.palette[index % theme.palette.length]),
      borderWidth: 0,
      hoverOffset: 4,
    }],
  };

  const valueVsCost = {
    labels: visible.map((asset) => asset.symbol),
    datasets: [
      {
        label: "Current value",
        data: visible.map((asset) => asset.currentValue),
        backgroundColor: theme.palette[0],
        borderRadius: 6,
      },
      {
        label: "Remaining cost basis",
        data: visible.map((asset) => asset.remainingCostBasis),
        backgroundColor: theme.palette[Math.min(3, theme.palette.length - 1)],
        borderRadius: 6,
      },
    ],
  };

  const sharedLegend = {
    labels: {
      color: theme.text,
      boxWidth: 10,
      boxHeight: 10,
      usePointStyle: true,
      pointStyle: "circle" as const,
    },
  };

  return (
    <section className="chart-grid">
      <article className="panel chart-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Allocation</span>
            <h2>Portfolio mix</h2>
          </div>
        </div>
        <div className="chart-canvas doughnut-canvas">
          <Doughnut
            data={allocation}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              cutout: "70%",
              plugins: {
                legend: sharedLegend,
                tooltip: {
                  callbacks: {
                    label: (context) => `${context.label}: ${format(Number(context.raw || 0))}`,
                  },
                },
              },
            }}
          />
        </div>
      </article>

      <article className="panel chart-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Value vs cost</span>
            <h2>Position comparison</h2>
          </div>
        </div>
        <div className="chart-canvas">
          <Bar
            data={valueVsCost}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: sharedLegend },
              scales: {
                x: {
                  ticks: { color: theme.text },
                  grid: { display: false },
                  border: { display: false },
                },
                y: {
                  ticks: {
                    color: theme.text,
                    callback: (value) => format(Number(value)),
                  },
                  grid: { color: theme.grid },
                  border: { display: false },
                },
              },
            }}
          />
        </div>
      </article>
    </section>
  );
}
