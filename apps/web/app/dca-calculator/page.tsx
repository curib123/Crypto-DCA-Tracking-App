import type { Metadata } from "next";
import Link from "next/link";
import { DcaCalculatorClient } from "@/components/dca-calculator-client";
import { NextFiLogo } from "@/components/nextfi-logo";

export const metadata: Metadata = {
  title: "Crypto DCA Calculator",
  description: "Calculate how recurring crypto DCA contributions can add up over 1, 3, 5 or 10 years using simple growth scenarios.",
  alternates: { canonical: "/dca-calculator" },
};

export default function DcaCalculatorPage() {
  return (
    <main className="calculator-page">
      <header className="calculator-header">
        <Link href="/" className="brand" aria-label="NextFi home">
          <NextFiLogo />
          <span>NextFi</span>
        </Link>
        <div>
          <Link href="/login" className="button button-ghost">Sign in</Link>
          <Link href="/login" className="button button-dark">Track my DCA</Link>
        </div>
      </header>

      <section className="calculator-intro">
        <span className="eyebrow">Free DCA calculator</span>
        <h1>See how your monthly DCA adds up.</h1>
        <p>Start with contributions only, then optionally test a simple growth scenario. NextFi keeps projections separate from your real portfolio ledger.</p>
      </section>

      <DcaCalculatorClient />

      <section className="calculator-save-cta">
        <div>
          <span className="eyebrow">Want to track the real purchases?</span>
          <h2>Save each DCA and let NextFi calculate your average entry and P/L.</h2>
        </div>
        <Link href="/login" className="button button-dark button-large">Start tracking free</Link>
      </section>
    </main>
  );
}
