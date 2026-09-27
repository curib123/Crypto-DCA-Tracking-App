import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { DialogProvider } from "@/components/ui/dialog-provider";

export const metadata: Metadata = {
  title: "Portfolio",
  robots: { index: false, follow: false, noarchive: true },
};

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <DialogProvider>
      <AppShell>{children}</AppShell>
    </DialogProvider>
  );
}
