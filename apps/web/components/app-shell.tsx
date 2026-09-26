"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/app", label: "Overview" },
  { href: "/app/transactions", label: "Transactions" },
  { href: "/app/market", label: "Market" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("crypto-dca-token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  function signOut() {
    localStorage.removeItem("crypto-dca-token");
    localStorage.removeItem("crypto-dca-user");
    router.push("/");
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
            <span className="eyebrow">DCA workspace</span>
            <strong>Track real cost, not hype.</strong>
          </div>
          <Link href="/app/transactions" className="button button-dark button-small">
            + Add DCA
          </Link>
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
