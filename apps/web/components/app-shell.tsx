"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiFetch, isNetworkFailure } from "@/lib/api";
import { NextFiLogo } from "@/components/nextfi-logo";
import { applyTheme, ThemeControl } from "@/components/theme-control";
import { AdSenseSlot } from "@/components/adsense-slot";
import { NavIcon } from "@/components/ui/nav-icon";
import { useDialog } from "@/components/ui/dialog-provider";
import { APP_NAVIGATION, MOBILE_NAVIGATION } from "@/config/navigation";
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
  active = false,
  children,
  onClick,
}: {
  href: string;
  className?: string;
  offline: boolean;
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const ariaCurrent = active ? "page" : undefined;

  if (offline) {
    return (
      <a href={href} className={className} aria-current={ariaCurrent} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} aria-current={ariaCurrent} onClick={onClick}>
      {children}
    </Link>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 7.5h15M4.5 12h15M4.5 16.5h15" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6.75 6.75 10.5 10.5M17.25 6.75 6.75 17.25" />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { confirm } = useDialog();
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  useEffect(() => {
    let mounted = true;

    async function warmOfflineRoutes() {
      if (!navigator.onLine) return;

      try {
        if ("serviceWorker" in navigator) await navigator.serviceWorker.ready;
        APP_NAVIGATION.forEach((link) => router.prefetch(link.href));
      } catch {
        // Route warming is an optimization only.
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

        if (!localStorage.getItem("nextfi-theme")) {
          localStorage.setItem("nextfi-theme", nextUser.themePreference);
          applyTheme(nextUser.themePreference);
        }

        await setActiveUser(nextUser);
        await syncOfflineQueue(nextUser.id);

        if (mounted) {
          setSessionUser(nextUser);
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

        if (canUseOffline && cachedUser) {
          if (mounted) {
            setSessionUser({
              ...cachedUser,
              role: "USER",
              themePreference: "SYSTEM",
            });
            setOffline(true);
            setReady(true);
          }
          return;
        }

        if (mounted) router.replace("/login");
      }
    }

    void verify();

    const onOnline = () => void verify();
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
    const approved = await confirm({
      title: "Sign out of NextFi?",
      description: offline
        ? "Your local offline data for this account will be cleared from this device."
        : "You can sign back in anytime with your Google account.",
      confirmLabel: "Sign out",
      tone: "danger",
    });

    if (!approved) return;

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

  if (!ready) {
    return (
      <main className="app-loading">
        <div className="app-loading-mark">
          <NextFiLogo />
          <span>Loading your workspace…</span>
        </div>
      </main>
    );
  }

  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <AppNavLink href="/app" offline={offline} className="brand brand-app">
          <NextFiLogo />
          <span>NextFi</span>
        </AppNavLink>

        <nav className="app-nav" aria-label="Application navigation">
          {APP_NAVIGATION.map((link) => {
            const active = pathname === link.href;

            return (
              <AppNavLink
                key={link.href}
                href={link.href}
                offline={offline}
                className={active ? "active" : undefined}
                active={active}
              >
                <span className="nav-icon">
                  <NavIcon name={link.icon} />
                </span>
                <span>{link.label}</span>
              </AppNavLink>
            );
          })}
        </nav>

        <div className="sidebar-account">
          <span className="sidebar-avatar">
            {(sessionUser?.email || "N").slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>Portfolio workspace</strong>
            <span>{sessionUser?.email || "Signed in"}</span>
          </div>
        </div>

        <div className="sidebar-foot">
          <AppNavLink href="/" offline={offline}>Landing page</AppNavLink>
          <button type="button" className="text-button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="desktop-topbar-copy">
            <span className="eyebrow">{offline ? "Offline mode" : "DCA workspace"}</span>
            <strong>{offline ? "Reading last synchronized data." : "Track real cost, not hype."}</strong>
          </div>

          <div className="mobile-topbar-brand">
            <button
              type="button"
              className="icon-button mobile-menu-button"
              aria-label="Open navigation"
              onClick={() => setDrawerOpen(true)}
            >
              <MenuIcon />
            </button>
            <AppNavLink href="/app" offline={offline} className="mobile-brand-link">
              <NextFiLogo />
              <span>NextFi</span>
            </AppNavLink>
          </div>

          <div className="topbar-actions">
            <ThemeControl compact syncAccount={!offline} />
            {offline && <span className="status-pill">Offline</span>}
            <AppNavLink
              href="/app/transactions?new=1"
              offline={offline}
              className="button button-dark button-small topbar-add"
            >
              <PlusIcon />
              Add DCA
            </AppNavLink>
          </div>
        </header>

        {children}
        {!offline && <AdSenseSlot placement="app" />}
      </div>

      <nav className="mobile-nav" aria-label="Mobile application navigation">
        {MOBILE_NAVIGATION.slice(0, 2).map((link) => {
          const active = pathname === link.href;

          return (
            <AppNavLink
              key={link.href}
              href={link.href}
              offline={offline}
              className={active ? "active" : undefined}
              active={active}
            >
              <NavIcon name={link.icon} size={19} />
              <span>{link.mobileLabel || link.label}</span>
            </AppNavLink>
          );
        })}

        <AppNavLink
          href="/app/transactions?new=1"
          offline={offline}
          className="mobile-add-action"
        >
          <span className="mobile-add-icon">
            <PlusIcon />
          </span>
          <span>Add</span>
        </AppNavLink>

        {MOBILE_NAVIGATION.slice(2).map((link) => {
          const active = pathname === link.href;

          return (
            <AppNavLink
              key={link.href}
              href={link.href}
              offline={offline}
              className={active ? "active" : undefined}
              active={active}
            >
              <NavIcon name={link.icon} size={19} />
              <span>{link.mobileLabel || link.label}</span>
            </AppNavLink>
          );
        })}
      </nav>

      {drawerOpen && (
        <div className="app-drawer-layer" role="presentation" onMouseDown={() => setDrawerOpen(false)}>
          <aside
            className="app-drawer"
            aria-label="App drawer"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="app-drawer-header">
              <AppNavLink href="/app" offline={offline} className="brand">
                <NextFiLogo />
                <span>NextFi</span>
              </AppNavLink>
              <button
                type="button"
                className="icon-button"
                aria-label="Close navigation"
                onClick={() => setDrawerOpen(false)}
              >
                <CloseIcon />
              </button>
            </header>

            <div className="drawer-profile">
              <span className="drawer-avatar">
                {(sessionUser?.email || "N").slice(0, 1).toUpperCase()}
              </span>
              <div>
                <span className="eyebrow">Signed in</span>
                <strong>{sessionUser?.email || "NextFi user"}</strong>
                <small>Base currency · {sessionUser?.baseCurrency || "USD"}</small>
              </div>
            </div>

            <nav className="drawer-nav">
              {APP_NAVIGATION.map((link) => {
                const active = pathname === link.href;

                return (
                  <AppNavLink
                    key={link.href}
                    href={link.href}
                    offline={offline}
                    active={active}
                    className={active ? "active" : undefined}
                  >
                    <span className="drawer-nav-icon">
                      <NavIcon name={link.icon} size={19} />
                    </span>
                    <span>{link.label}</span>
                  </AppNavLink>
                );
              })}
            </nav>

            <div className="drawer-section">
              <span className="eyebrow">Appearance</span>
              <ThemeControl syncAccount={!offline} />
            </div>

            <div className="drawer-actions">
              <AppNavLink href="/" offline={offline} className="button button-light button-wide">
                Landing page
              </AppNavLink>
              <button
                type="button"
                className="button button-danger button-wide"
                onClick={() => void signOut()}
              >
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
