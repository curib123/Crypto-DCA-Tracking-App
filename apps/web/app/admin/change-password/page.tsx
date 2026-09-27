import type { Metadata } from "next";
import { AdminChangePasswordClient } from "@/components/admin-change-password-client";

export const metadata: Metadata = {
  title: "Change Control Panel Password",
  robots: { index: false, follow: false, noarchive: true },
};

export default function AdminChangePasswordPage() {
  return <AdminChangePasswordClient />;
}
