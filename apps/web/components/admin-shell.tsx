"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { NextFiLogo } from "@/components/nextfi-logo";
import { ThemeControl } from "@/components/theme-control";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/ads", label: "AdSense" },
  { href: "/admin/content", label: "Landing CMS" },
  { href: "/admin/audit", label: "Audit log" },
];

type ControlAdmin = {
  id: string;
  username: string;
  mustChangePassword: boolean;
};

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const authRoute =
    pathname === "/admin/login" ||
    pathname === "/admin/change-password";

  useEffect(() => {
    if (authRoute) {
      setReady(true);
      return;
    }

    let mounted = true;

    apiFetch<ControlAdmin>("/admin-auth/me")
      .then((admin) => {
        if (!mounted) return;
        if (admin.mustChangePassword) {
          router.replace("/admin/change-password");
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (mounted) router.replace("/admin/login");
      });

    return () => {
      mounted = false;
    };
  }, [authRoute, router]);

  async function signOut() {
    try {
      await apiFetch("/admin-auth/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  if (!ready) {
    return <main className="app-loading">Checking control-panel access…</main>;
  }

  if (authRoute) {
    return <>{children}</>;
  }

  return (
    <div className="admin-frame">
      <aside className="admin-sidebar">
        <Link href="/admin" className="brand brand-app">
          <NextFiLogo />
          <span>NextFi Control</span>
        </Link>

        <nav className="app-nav" aria-label="Control panel navigation">
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
          <button type="button" className="text-button" onClick={signOut}>
            Lock control panel
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div>
            <span className="eyebrow">Secure control panel</span>
            <strong>Server-authorized administration.</strong>
          </div>
          <ThemeControl compact />
        </header>
        {children}
      </div>
    </div>
  );
}
