import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false, noarchive: true },
};

export default function OfflinePage() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">Offline</span>
        <h1>Your connection is unavailable.</h1>
        <p>
          Previously loaded app data may still be visible. New DCA entries can be queued
          from the transactions screen when that screen is already available on your device.
        </p>
        <Link className="button button-dark button-wide" href="/app/transactions">
          Return to transactions
        </Link>
      </div>
    </main>
  );
}
