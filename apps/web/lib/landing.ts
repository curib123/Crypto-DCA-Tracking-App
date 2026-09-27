import { cache } from "react";

export type LandingFeature = { title: string; description: string };
export type LandingFaq = { question: string; answer: string };
export type LandingContent = {
  brandName: string;
  announcement: string;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  features: LandingFeature[];
  faq: LandingFaq[];
  footerText: string;
  seoTitle: string;
  seoDescription: string;
};

const fallback: LandingContent = {
  brandName: "NextFi",
  announcement: "Installable PWA · DCA-first portfolio analytics",
  heroEyebrow: "Crypto DCA, made measurable",
  heroTitle: "Know exactly what your DCA is doing.",
  heroDescription:
    "Track real contributions, weighted average cost, break-even, fees and portfolio performance in one clean workspace.",
  primaryCtaLabel: "Continue with Google",
  secondaryCtaLabel: "Install NextFi",
  features: [
    { title: "Real cost basis", description: "Weighted calculations are rebuilt from your transaction ledger." },
    { title: "Clear performance", description: "Separate invested capital, current value, realized P/L and unrealized P/L." },
    { title: "Multi-currency", description: "Preserve original quote currencies while reporting in your base currency." },
    { title: "Offline-ready", description: "Read synchronized data and queue supported transactions without a connection." },
  ],
  faq: [
    { question: "Does NextFi hold my crypto?", answer: "No. NextFi tracks portfolio data and never asks for seed phrases or private keys." },
    { question: "How is average cost calculated?", answer: "The app rebuilds weighted cost basis from the transaction ledger." },
  ],
  footerText: "Portfolio tracking and analytics only. Not financial advice.",
  seoTitle: "NextFi — Crypto DCA Tracking & Portfolio Analytics",
  seoDescription:
    "Track crypto DCA contributions, weighted average cost, break-even, portfolio value and profit/loss in an installable PWA.",
};

export const getLandingContent = cache(async (): Promise<LandingContent> => {
  const configured = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
  const base = configured.startsWith("http") ? configured : "http://localhost:4000/api";

  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/content/landing`, {
      cache: "no-store",
    });
    if (!response.ok) return fallback;
    const value = await response.json();
    return { ...fallback, ...value };
  } catch {
    return fallback;
  }
});
