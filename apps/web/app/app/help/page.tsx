import Link from "next/link";

export default function HelpPage() {
  return (
    <div className="app-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Help & feedback</span>
          <h1>Using NextFi.</h1>
          <p>Quick answers for portfolio tracking, offline sync, DCA plans and market data.</p>
        </div>
      </div>

      <section className="help-grid">
        <article className="panel help-card">
          <span className="eyebrow">Transactions</span>
          <h2>Why does my portfolio come from the ledger?</h2>
          <p>Transactions are the source of truth. NextFi recalculates holdings, weighted cost, break-even and profit/loss from your recorded activity.</p>
        </article>
        <article className="panel help-card">
          <span className="eyebrow">Offline</span>
          <h2>Can I add a DCA while offline?</h2>
          <p>Yes, after you have signed in online on the device at least once. Supported transactions are queued locally and synchronized after reconnecting.</p>
        </article>
        <article className="panel help-card">
          <span className="eyebrow">DCA plans</span>
          <h2>Does a plan automatically buy crypto?</h2>
          <p>No. Plans are reminders and schedules only. NextFi never moves funds or executes a trade. Record the actual contribution after you buy.</p>
        </article>
        <article className="panel help-card">
          <span className="eyebrow">Market</span>
          <h2>Why can market data look stale?</h2>
          <p>NextFi caches CoinGecko snapshots for reliability and offline use. The Market screen shows when data is cached or offline.</p>
        </article>
      </section>

      <section className="panel feedback-card">
        <div>
          <span className="eyebrow">Feedback</span>
          <h2>Found a bug or have an idea?</h2>
          <p>Open a GitHub issue for NextFi so the report stays attached to the project and can be tracked.</p>
        </div>
        <a
          className="button button-dark"
          href="https://github.com/curib123/Crypto-DCA-Tracking-App/issues/new"
          target="_blank"
          rel="noopener noreferrer"
        >
          Send feedback ↗
        </a>
      </section>

      <p className="data-disclaimer">
        NextFi is portfolio tracking and analytics software. It does not custody assets or execute trades.
      </p>
    </div>
  );
}
