"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch, isNetworkFailure } from "@/lib/api";
import { NextFiLogo } from "@/components/nextfi-logo";
import { applyTheme, ThemeControl } from "@/components/theme-control";
import { AdSenseSlot } from "@/components/adsense-slot";
import { NavIcon } from "@/components/ui/nav-icon";
import { AlertModal, ConfirmModal } from "@/components/ui/app-modal";
import { TransactionFormModal } from "@/components/transaction-form-modal";
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

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

async function syncOfflineQueue(userId: string) {
  const queued = await pendingTransactions(userId);
  let changed = false;

  for (const row of queued) {
    const id = String(row._offlineId);
    const { _offlineId, _queuedAt, _userId, ...payload } = row;

    try {
      await apiFetch("/transactions", { method: "POST", body: JSON.stringify(payload) });
      await removePending(id);
      changed = true;
    } catch {
      break;
    }
  }

  if (changed) window.dispatchEvent(new Event("crypto-dca-data-updated"));
}

function isActivePath(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(href + "/");
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
    return <a href={href} className={className} aria-current={ariaCurrent} onClick={onClick}>{children}</a>;
  }
  return <Link href={href} className={className} aria-current={ariaCurrent} onClick={onClick}>{children}</Link>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transactionAsset, setTransactionAsset] = useState("BTC");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  const openTransaction = useCallback((asset = "BTC") => {
    setTransactionAsset(asset);
    setTransactionOpen(true);
    setDrawerOpen(false);
  }, []);

  useEffect(() => {
    const onTransaction = (event: Event) => {
      const custom = event as CustomEvent<{ asset?: string }>;
      openTransaction(custom.detail?.asset || "BTC");
    };
    const onLogout = () => setLogoutOpen(true);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    window.addEventListener("nextfi-open-transaction", onTransaction);
    window.addEventListener("nextfi-request-logout", onLogout);
    window.addEventListener("beforeinstallprompt", onInstall);

    return () => {
      window.removeEventListener("nextfi-open-transaction", onTransaction);
      window.removeEventListener("nextfi-request-logout", onLogout);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, [openTransaction]);

  useEffect(() => {
    let mounted = true;

    async function warmOfflineRoutes() {
      if (!navigator.onLine) return;
      try {
        if ("serviceWorker" in navigator) await navigator.serviceWorker.ready;
        APP_NAVIGATION.forEach((link) => router.prefetch(link.href));
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
              // Keep the marker and retry online later.
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
        const canUseOffline = Boolean(cachedUser) && (!navigator.onLine || isNetworkFailure(error));

        if (canUseOffline) {
          if (mounted) {
            setUser(cachedUser as SessionUser);
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
    setSigningOut(true);
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
      setSigningOut(false);
      setLogoutOpen(false);

      if (online) {
        router.push("/");
        router.refresh();
      } else {
        window.location.assign("/");
      }
    }
  }

  async function installApp() {
    setDrawerOpen(false);
    if (!installPrompt) {
      setFeedback("If the install prompt is not available, use your browser menu and choose “Install app” or “Add to Home screen”.");
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  if (!ready) return <main className="app-loading">Loading NextFi…</main>;

  const initials = user?.email?.slice(0, 1).toUpperCase() || "N";

  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <AppNavLink href="/app" offline={offline} className="brand brand-app">
          <NextFiLogo />
          <span>NextFi</span>
        </AppNavLink>

        <nav className="app-nav" aria-label="Application navigation">
          {APP_NAVIGATION.map((link) => {
            const active = isActivePath(pathname, link.href);
            return (
              <AppNavLink
                key={link.href}
                href={link.href}
                offline={offline}
                className={active ? "active" : undefined}
                active={active}
              >
                <span className="nav-icon"><NavIcon name={link.icon} /></span>
                <span>{link.label}</span>
              </AppNavLink>
            );
          })}
        </nav>

        <div className="sidebar-account">
          <span className="account-avatar">{initials}</span>
          <div><strong>{user?.email || "NextFi user"}</strong><span>{user?.baseCurrency || "USD"} portfolio</span></div>
        </div>

        <div className="sidebar-foot">
          <button type="button" className="text-button" onClick={() => void installApp()}>Install NextFi</button>
          <AppNavLink href="/" offline={offline}>Landing page</AppNavLink>
          <button type="button" className="text-button danger-text" onClick={() => setLogoutOpen(true)}>Log out</button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="desktop-topbar-copy">
            <span className="eyebrow">{offline ? "Offline mode" : "NextFi portfolio"}</span>
            <strong>{offline ? "Reading synchronized data." : "Track cost, value and DCA in one place."}</strong>
          </div>

          <div className="mobile-topbar">
            <button type="button" className="icon-button" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
              <span aria-hidden="true">☰</span>
            </button>
            <Link href="/app" className="brand brand-app"><NextFiLogo /><span>NextFi</span></Link>
          </div>

          <div className="topbar-actions">
            {offline && <span className="status-pill">Offline</span>}
            <ThemeControl compact syncAccount={!offline} />
            <button type="button" className="button button-dark button-small desktop-add" onClick={() => openTransaction()}>
              + Add transaction
            </button>
            <button type="button" className="account-button" onClick={() => setDrawerOpen(true)} aria-label="Open profile menu">{initials}</button>
          </div>
        </header>

        {children}
        {!offline && <AdSenseSlot placement="app" />}
      </div>

      <nav className="mobile-nav" aria-label="Mobile application navigation">
        {MOBILE_NAVIGATION.slice(0, 2).map((link) => {
          const active = isActivePath(pathname, link.href);
          return (
            <AppNavLink key={link.href} href={link.href} offline={offline} className={active ? "active" : undefined} active={active}>
              <NavIcon name={link.icon} size={20} />
              <span>{link.mobileLabel || link.label}</span>
            </AppNavLink>
          );
        })}

        <button type="button" className="mobile-add-action" onClick={() => openTransaction()} aria-label="Add transaction">
          <span><NavIcon name="plus" size={22} /></span>
          <small>Add</small>
        </button>

        {MOBILE_NAVIGATION.slice(2).map((link) => {
          const active = isActivePath(pathname, link.href);
          return (
            <AppNavLink key={link.href} href={link.href} offline={offline} className={active ? "active" : undefined} active={active}>
              <NavIcon name={link.icon} size={20} />
              <span>{link.mobileLabel || link.label}</span>
            </AppNavLink>
          );
        })}
      </nav>

      <div className={drawerOpen ? "drawer-layer open" : "drawer-layer"} aria-hidden={!drawerOpen}>
        <button type="button" className="drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-label="Close menu" />
        <aside className="app-drawer">
          <div className="drawer-head">
            <div className="drawer-profile">
              <span className="account-avatar large">{initials}</span>
              <div><strong>{user?.email || "NextFi user"}</strong><span>Base currency · {user?.baseCurrency || "USD"}</span></div>
            </div>
            <button type="button" className="modal-close" onClick={() => setDrawerOpen(false)} aria-label="Close menu">×</button>
          </div>

          <nav className="drawer-nav" aria-label="App drawer navigation">
            {APP_NAVIGATION.map((link) => (
              <AppNavLink
                key={link.href}
                href={link.href}
                offline={offline}
                active={isActivePath(pathname, link.href)}
                className={isActivePath(pathname, link.href) ? "active" : undefined}
                onClick={() => setDrawerOpen(false)}
              >
                <NavIcon name={link.icon} />
                <span>{link.label}</span>
              </AppNavLink>
            ))}
          </nav>

          <div className="drawer-section">
            <span className="eyebrow">Appearance</span>
            <ThemeControl syncAccount={!offline} />
          </div>

          <div className="drawer-links">
            <button type="button" onClick={() => void installApp()}>Install app</button>
            <Link href="/privacy" onClick={() => setDrawerOpen(false)}>Privacy</Link>
            <Link href="/terms" onClick={() => setDrawerOpen(false)}>Terms</Link>
            <Link href="/" onClick={() => setDrawerOpen(false)}>About NextFi</Link>
          </div>

          <button type="button" className="button button-danger button-wide drawer-logout" onClick={() => {
            setDrawerOpen(false);
            setLogoutOpen(true);
          }}>Log out</button>
        </aside>
      </div>

      <TransactionFormModal
        open={transactionOpen}
        initialAsset={transactionAsset}
        onClose={() => setTransactionOpen(false)}
        onSaved={(message) => setFeedback(message)}
      />

      <ConfirmModal
        open={logoutOpen}
        title="Log out of NextFi?"
        description="You’ll need to sign in again to access your synchronized portfolio on this device."
        confirmLabel="Log out"
        destructive
        busy={signingOut}
        onClose={() => setLogoutOpen(false)}
        onConfirm={signOut}
      />

      <AlertModal
        open={Boolean(feedback)}
        title={feedback.includes("offline") ? "Saved for sync" : "All set"}
        description={feedback}
        onClose={() => setFeedback("")}
      />
    </div>
  );
}
