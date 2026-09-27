import type { Metadata } from "next";
import { AdminAdsClient } from "@/components/admin-ads-client";

export const metadata: Metadata = {
  title: "AdSense Control",
  robots: { index: false, follow: false, noarchive: true },
};

export default function AdminAdsPage() {
  return <AdminAdsClient />;
}
