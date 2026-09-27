import Link from "next/link";
import { NextFiLogo } from "@/components/nextfi-logo";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <Link href="/" className="brand"><NextFiLogo /><span>NextFi</span></Link>
        <span className="eyebrow">Privacy</span>
        <h1>Privacy at NextFi</h1>
        <p className="legal-lead">NextFi is a portfolio tracker. It does not custody cryptocurrency or receive wallet private keys.</p>

        <section>
          <h2>Account information</h2>
          <p>Google sign-in provides the identity information required to create and secure your NextFi account, such as your Google subject identifier, email address, name and profile image when available.</p>
        </section>
        <section>
          <h2>Portfolio information</h2>
          <p>Transactions, DCA plans, reporting currency and app preferences are stored so the service can calculate cost basis and portfolio analytics. Previously synchronized data may also be cached on your device for offline use.</p>
        </section>
        <section>
          <h2>External data services</h2>
          <p>Market prices can be retrieved from CoinGecko. When optional AI insights are configured, NextFi sends calculated portfolio context to the configured Mistral service to generate explanatory text. AI features do not receive custody or trade-execution access.</p>
        </section>
        <section>
          <h2>Your device</h2>
          <p>Signing out clears NextFi's cached user data from the current device. Some browser-managed storage or site data may also be cleared through your browser settings.</p>
        </section>

        <div className="legal-actions"><Link className="button button-dark" href="/">Back to NextFi</Link></div>
      </div>
    </main>
  );
}
