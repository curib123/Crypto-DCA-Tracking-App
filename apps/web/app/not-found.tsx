import Link from "next/link";
import { NextFiLogo } from "@/components/nextfi-logo";

export default function NotFound() {
  return (
    <main className="system-state-page">
      <div className="system-state-card panel">
        <NextFiLogo />
        <span className="eyebrow">404</span>
        <h1>This page is not in your ledger.</h1>
        <p>The address may have changed or the page does not exist.</p>
        <div><Link className="button button-dark" href="/app">Open NextFi</Link><Link className="button button-light" href="/">Go home</Link></div>
      </div>
    </main>
  );
}
