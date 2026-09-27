import type { Metadata } from "next";
import { InsightsClient } from "@/components/insights-client";

export const metadata: Metadata = {
  title: "AI Insights",
  robots: { index: false, follow: false },
};

export default function InsightsPage() {
  return <InsightsClient />;
}
