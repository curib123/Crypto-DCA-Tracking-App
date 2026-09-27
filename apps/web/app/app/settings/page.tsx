import type { Metadata } from "next";
import { SettingsClient } from "@/components/settings-client";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return <SettingsClient />;
}
