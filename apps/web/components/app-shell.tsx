"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiFetch, isNetworkFailure } from "@/lib/api";
import { NextFiLogo } from "@/components/nextfi-logo";
import { ThemeControl } from "@/components/theme-control";
import {
  clearActiveUser,
  clearLogoutPending,
  clearUserOfflineData,
  getActiveUser,
  isLogoutPending,
  markLogoutPending,
  pendingTransactions,
  removePending,
  setActiveUser,
} from "@/lib/offline";

const links = [
  { href: "/app", label: "Overview" },
  { href: "/app/transactions", label: "Transactions" },
  { href: "/app/market", label: "Market" },
  { href: "/app/insights", label: "AI Insights" },
  { href: "/app/settings", label: "Settings" },
];

type SessionUser = {
  id: string;
  email: string;
  baseCurrency: string;
  role: "USER" | "ADMIN";
  themePreference: "SYSTEM" | "LIGHT" | "DARK";
};

async function syncOfflineQueue(userId: string) {
  const queued = await pendingTransactions(userId);
  let changed = false;

  for (const row of queued) {
    const id = String(row._offlineId);
    const { _offlineId, _queuedAt, _userId, ...payload } = row;

    try {
      await apiFetch("/transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await removePending(id);
      changed = true;
    } catch {
      break;
    }
  }

  if (changed) window.dispatchEvent(new Event("crypto-dca-data-updated"));
}

function AppNavLink({
  href,
  className,
  offline,
  children,
}: {
  href: string;
  className?: string;
  offline: boolean;
  children: React.ReactNode;
}) {
  if (offline) return <a href={href} className={className}>{children}</a>;
  return <Link href={href} className={className}>{children}</Link>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let mounted = true;

    async function warmOfflineRoutes() {
      if (!navigator.onLine) return;
      try {
        if ("serviceWorker" in navigator) await navigator.serviceWorker.ready;
        links.forEach((link) => router.prefetch(link.href));
      } catch {
        // Prefetch is an optimization only.
      }
    }

    async function verify() {
      try {
        const pendingLogout = await isLogoutPending();

        if (pendingLogout) {
          if (navigator.onLine) {
            try {
              await apiFetch("/auth/logout", { method: "POST" }, false);
              await clearLogoutPending();
            } catch {
              // Keep the marker and retry when online later.
            }
          }
          await clearActiveUser();
          if (mounted) router.replace("/login");
          return;
        }

        const nextUser = await apiFetch<SessionUser>("/auth/me");
        await setActiveUser(nextUser);
        await syncOfflineQueue(nextUser.id);

        if (mounted) {
          setUser(nextUser);
          setOffline(false);
          setReady(true);
        }
        void warmOfflineRoutes();
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
    const onOnline = () => verify();
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
    const online = navigator.onLine;

    try {
      if (online) {
        await apiFetch("/auth/logout", { method: "POST" }, false);
        await clearLogoutPending();
      } else {
        await markLogoutPending();
      }
    } finally {
      if (active) await clearUserOfflineData(active.id);
      await clearActiveUser();

      if (online) {
        router.push("/");
        router.refresh();
      } else {
        window.location.assign("/");
      }
    }
  }

  if (!ready) return <main className="app-loading">Loading NextFi…</main>;

  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <AppNavLink href="/app" offline={offline} className="brand brand-app">
          <NextFiLogo />
          <span>NextFi</span>
        </AppNavLink>

        <nav className="app-nav" aria-label="Application navigation">
          {links.map((link) => (
            <AppNavLink
              key={link.href}
              href={link.href}
              offline={offline}
              className={pathname === link.href ? "active" : undefined}
            >
              {link.label}
            </AppNavLink>
          ))}
          {user?.role === "ADMIN" && !offline && (
            <Link href="/admin" className={pathname.startsWith("/admin") ? "active" : undefined}>
              Admin
            </Link>
          )}
        </nav>

        <div className="sidebar-foot">
          <AppNavLink href="/" offline={offline}>Landing page</AppNavLink>
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
            <ThemeControl compact syncAccount={!offline} />
            {offline && <span className="status-pill">Offline</span>}
            <AppNavLink href="/app/transactions" offline={offline} className="button button-dark button-small">
              + Add DCA
            </AppNavLink>
          </div>
        </header>
        {children}
      </div>

      <nav className="mobile-nav" aria-label="Mobile application navigation">
        {links.slice(0, 4).map((link) => (
          <AppNavLink
            key={link.href}
            href={link.href}
            offline={offline}
            className={pathname === link.href ? "active" : undefined}
          >
            {link.label === "Transactions" ? "Ledger" : link.label === "AI Insights" ? "Insights" : link.label}
          </AppNavLink>
        ))}
      </nav>
    </div>
  );
}
