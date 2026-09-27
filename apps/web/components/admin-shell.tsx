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
  { href: "/admin/content", label: "Landing CMS" },
  { href: "/admin/audit", label: "Audit log" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    apiFetch<{ role: "USER" | "ADMIN" }>("/auth/me")
      .then((user) => {
        if (user.role !== "ADMIN") {
          router.replace("/app");
          return;
        }
        setReady(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!ready) return <main className="app-loading">Checking administrator access…</main>;

  return (
    <div className="admin-frame">
      <aside className="admin-sidebar">
        <Link href="/admin" className="brand brand-app">
          <NextFiLogo />
          <span>NextFi Admin</span>
        </Link>
        <nav className="app-nav" aria-label="Admin navigation">
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
          <Link href="/app">User app</Link>
          <Link href="/">Landing page</Link>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div>
            <span className="eyebrow">Administration</span>
            <strong>Product, users and platform analytics.</strong>
          </div>
          <ThemeControl compact syncAccount />
        </header>
        {children}
      </div>
    </div>
  );
}
