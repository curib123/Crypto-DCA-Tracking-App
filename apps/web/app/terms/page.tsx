import Link from "next/link";
import { NextFiLogo } from "@/components/nextfi-logo";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <Link href="/" className="brand"><NextFiLogo /><span>NextFi</span></Link>
        <span className="eyebrow">Terms</span>
        <h1>Using NextFi</h1>
        <p className="legal-lead">NextFi provides portfolio tracking and analytics. It is not an exchange, broker, custodian, or investment adviser.</p>

        <section>
          <h2>Tracking only</h2>
          <p>You are responsible for the transaction information you record. Portfolio calculations depend on the accuracy and completeness of that ledger.</p>
        </section>
        <section>
          <h2>DCA plans</h2>
          <p>DCA plans are scheduling and reminder records only. Creating a plan does not place an order, transfer funds, or guarantee that a future contribution will occur.</p>
        </section>
        <section>
          <h2>Market and AI information</h2>
          <p>Market data may be delayed, unavailable, or supplied from cached fallback data. AI-generated explanations describe tracked analytics and should not be treated as price predictions or instructions to buy, sell, or hold an asset.</p>
        </section>
        <section>
          <h2>Financial decisions</h2>
          <p>Crypto assets can be volatile. You remain responsible for your own financial decisions, security practices, tax records and compliance obligations.</p>
        </section>

        <div className="legal-actions"><Link className="button button-dark" href="/">Back to NextFi</Link></div>
      </div>
    </main>
  );
}
