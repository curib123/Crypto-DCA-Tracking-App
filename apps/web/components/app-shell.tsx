"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiFetch, isNetworkFailure } from "@/lib/api";
import {
  clearActiveUser,
  clearUserOfflineData,
  getActiveUser,
  setActiveUser,
} from "@/lib/offline";

const links = [
  { href: "/app", label: "Overview" },
  { href: "/app/transactions", label: "Transactions" },
  { href: "/app/market", label: "Market" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function verify() {
      try {
        const user = await apiFetch<{ id: string; email: string; baseCurrency: string }>("/auth/me");
        await setActiveUser(user);
        if (mounted) {
          setOffline(false);
          setReady(true);
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await clearActiveUser();
          if (mounted) router.replace("/login");
          return;
        }

        const cachedUser = await getActiveUser();
        const canUseOffline =
          Boolean(cachedUser) &&
          (!navigator.onLine || isNetworkFailure(error));

        if (canUseOffline) {
          if (mounted) {
            setOffline(true);
            setReady(true);
          }
          return;
        }

        if (mounted) router.replace("/login");
      }
    }

    verify();

    const onOnline = () => {
      verify();
    };
    const onOffline = () => setOffline(true);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      mounted = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [router]);

  async function signOut() {
    const active = await getActiveUser();

    try {
      if (navigator.onLine) {
        await apiFetch("/auth/logout", { method: "POST" }, false);
      }
    } finally {
      if (active) await clearUserOfflineData(active.id);
      await clearActiveUser();
      router.push("/");
      router.refresh();
    }
  }

  if (!ready) {
    return <main className="app-loading">Loading your portfolio…</main>;
  }

  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <Link href="/app" className="brand brand-app" aria-label="Crypto DCA Tracking App">
          <span className="brand-mark" aria-hidden="true">D</span>
          <span>Crypto DCA</span>
        </Link>

        <nav className="app-nav" aria-label="Application navigation">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? "active" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-foot">
          <Link href="/">Landing page</Link>
          <button type="button" className="text-button" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div>
            <span className="eyebrow">{offline ? "Offline mode" : "DCA workspace"}</span>
            <strong>{offline ? "Reading last synchronized data." : "Track real cost, not hype."}</strong>
          </div>
          <div className="topbar-actions">
            {offline && <span className="status-pill">Offline</span>}
            <Link href="/app/transactions" className="button button-dark button-small">
              + Add DCA
            </Link>
          </div>
        </header>
        {children}
      </div>

      <nav className="mobile-nav" aria-label="Mobile application navigation">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : undefined}>
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
