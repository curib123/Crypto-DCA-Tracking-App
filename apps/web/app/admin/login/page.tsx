import type { Metadata } from "next";
import { AdminLoginClient } from "@/components/admin-login-client";

export const metadata: Metadata = {
  title: "Control Panel Login",
  robots: { index: false, follow: false, noarchive: true },
};

export default function AdminLoginPage() {
  return <AdminLoginClient />;
}
