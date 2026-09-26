import Link from "next/link";
import { InstallButton } from "@/components/install-button";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Crypto DCA Tracking App",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web, Android, iOS, Windows, macOS",
  url: siteUrl,
  description:
    "An installable crypto DCA tracking PWA for actual invested money, weighted average buy price, break-even, portfolio value, fees and profit/loss.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Crypto DCA transaction tracking",
    "Weighted average buy price",
    "Break-even tracking",
    "Realized and unrealized profit/loss",
    "Multi-currency transactions",
    "Offline transaction queue",
    "Live crypto market prices",
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What does a crypto DCA tracker calculate?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Crypto DCA Tracking App records each investment and calculates accumulated crypto, actual contributions, weighted average entry price, break-even, current value, fees and profit or loss.",
      },
    },
    {
      "@type": "Question",
      name: "Does Crypto DCA Tracking App hold my cryptocurrency?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. The app is a portfolio tracking and analytics tool. It does not custody crypto and does not ask for seed phrases or private keys.",
      },
    },
    {
      "@type": "Question",
      name: "Can I install the crypto DCA tracker on my phone?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Crypto DCA Tracking App is a Progressive Web App that can be installed from supported browsers and opened from your home screen.",
      },
    },
  ],
};

const features = [
  ["Actual invested", "Record the money you really spent instead of estimating contributions from today's market price."],
  ["Weighted average", "Every buy is quantity-weighted so your average entry reflects your real cost basis."],
  ["Break-even", "See the market price your remaining position needs to reach before unrealized P/L returns to zero."],
  ["Real P/L", "Keep realized and unrealized profit or loss separate so selling does not distort your open position."],
  ["Multi-currency", "Record USD, PHP, EUR, GBP, SGD, stablecoin and other supported quote currencies."],
  ["Offline ready", "Queue a DCA entry without a connection and synchronize it when your device comes back online."],
];

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <main className="landing">
        <header className="site-header">
          <Link href="/" className="brand" aria-label="Crypto DCA Tracking App home">
            <span className="brand-mark" aria-hidden="true">D</span>
            <span>Crypto DCA</span>
          </Link>

          <nav className="site-nav" aria-label="Main navigation">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="header-actions">
            <Link href="/login" className="button button-ghost">Sign in</Link>
            <Link href="/register" className="button button-dark">Start free</Link>
          </div>
        </header>

        <section className="hero-section">
          <div className="hero-copy">
            <div className="announcement">
              <span className="announcement-dot" />
              Installable PWA · DCA-first portfolio accounting
            </div>

            <h1>Know exactly what your crypto DCA is doing.</h1>
            <p className="hero-lead">
              Track actual invested money, weighted average buy price, break-even,
              fees and profit/loss without turning your portfolio into a trading casino.
            </p>

            <div className="hero-actions">
              <Link href="/register" className="button button-dark button-large">Create free account</Link>
              <InstallButton className="button button-light button-large" />
            </div>

            <div className="trust-row" aria-label="Product principles">
              <span>No custody</span>
              <span>No seed phrases</span>
              <span>Transaction-ledger based</span>
              <span>Multi-currency</span>
            </div>
          </div>

          <div className="product-preview" aria-label="Crypto DCA dashboard preview">
            <div className="preview-top">
              <div>
                <span className="eyebrow">Portfolio value</span>
                <strong>$4,842.18</strong>
              </div>
              <span className="preview-chip">+18.42%</span>
            </div>

            <div className="preview-stats">
              <div>
                <span>Actual invested</span>
                <strong>$4,088.00</strong>
              </div>
              <div>
                <span>Lifetime P/L</span>
                <strong>+$754.18</strong>
              </div>
              <div>
                <span>Fees tracked</span>
                <strong>$22.64</strong>
              </div>
            </div>

            <div className="preview-chart" aria-hidden="true">
              <div className="chart-labels">
                <span>Portfolio value</span>
                <span>Money invested</span>
              </div>
              <svg viewBox="0 0 600 210" role="img" aria-label="Illustrative portfolio and contribution chart">
                <path d="M0 170 C70 162, 95 140, 140 146 S220 120, 260 128 S335 86, 380 96 S465 44, 600 35" fill="none" stroke="currentColor" strokeWidth="4" />
                <path d="M0 184 L80 184 L80 168 L180 168 L180 146 L300 146 L300 124 L420 124 L420 102 L600 102" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="8 8" opacity=".35" />
              </svg>
            </div>

            <div className="preview-position">
              <div className="coin-dot">B</div>
              <div>
                <strong>Bitcoin</strong>
                <span>0.042318 BTC</span>
              </div>
              <div className="preview-position-right">
                <span>Avg. entry</span>
                <strong>$81,420</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="logo-strip" aria-label="Core tracking capabilities">
          <span>AVERAGE ENTRY</span>
          <span>BREAK-EVEN</span>
          <span>REALIZED P/L</span>
          <span>UNREALIZED P/L</span>
          <span>MULTI-CURRENCY</span>
          <span>OFFLINE PWA</span>
        </section>

        <section className="section" id="features">
          <div className="section-heading">
            <span className="eyebrow">Built for long-term DCA</span>
            <h2>A portfolio tracker that starts with your transactions.</h2>
            <p>
              Market prices change every second. Your cost basis should not. The ledger remains the source of truth.
            </p>
          </div>

          <div className="feature-grid">
            {features.map(([title, description], index) => (
              <article className="feature-card" key={title}>
                <span className="feature-index">0{index + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section split-section" id="how-it-works">
          <div className="section-heading sticky-heading">
            <span className="eyebrow">How it works</span>
            <h2>Record once. Recalculate everything.</h2>
            <p>
              Add each DCA buy with the real amount, quantity and fees. Crypto DCA Tracking App rebuilds your position from the ledger.
            </p>
          </div>

          <div className="steps">
            <article>
              <span>01</span>
              <div>
                <h3>Add the transaction</h3>
                <p>Enter asset, actual money spent, crypto received, price, fees, currency and date.</p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>Build your cost basis</h3>
                <p>Weighted calculations update average entry, remaining cost and realized P/L after sells.</p>
              </div>
            </article>
            <article>
              <span>03</span>
              <div>
                <h3>Compare with the market</h3>
                <p>Live prices are layered on top of your ledger to calculate current value and unrealized performance.</p>
              </div>
            </article>
            <article>
              <span>04</span>
              <div>
                <h3>Keep accumulating</h3>
                <p>Use the same process for BTC, ETH, SOL and other supported assets while keeping one consistent record.</p>
              </div>
            </article>
          </div>
        </section>

        <section className="section seo-section">
          <div className="seo-panel">
            <div>
              <span className="eyebrow">Crypto DCA tracker</span>
              <h2>Average buy price is only useful when the input is real.</h2>
            </div>
            <div>
              <p>
                Crypto DCA Tracking App is designed for investors who want a clear record of recurring cryptocurrency purchases.
                Instead of showing only today's token prices, it records the amount invested for each transaction and uses that
                ledger to calculate weighted average cost, remaining cost basis and break-even.
              </p>
              <p>
                Use it as a Bitcoin DCA tracker, Ethereum DCA tracker or multi-asset crypto portfolio tracker. Your portfolio can
                display in a preferred base currency while preserving the original currency of each transaction.
              </p>
            </div>
          </div>
        </section>

        <section className="section" id="faq">
          <div className="section-heading">
            <span className="eyebrow">FAQ</span>
            <h2>Clear answers before you install.</h2>
          </div>

          <div className="faq-grid">
            <details open>
              <summary>Does this app buy or hold cryptocurrency?</summary>
              <p>No. It tracks transactions and portfolio analytics. The MVP does not custody funds or execute trades.</p>
            </details>
            <details>
              <summary>How is average buy price calculated?</summary>
              <p>Using weighted cost basis from transaction quantity and actual contribution, rather than a simple average of quoted prices.</p>
            </details>
            <details>
              <summary>Can I record PHP and USDT purchases?</summary>
              <p>Yes. Transactions keep their original quote currency and can include an FX-to-base rate for consistent portfolio reporting.</p>
            </details>
            <details>
              <summary>Does the PWA work offline?</summary>
              <p>You can queue transaction entries offline. The app synchronizes pending records when the connection returns.</p>
            </details>
          </div>
        </section>

        <section className="final-cta">
          <div>
            <span className="eyebrow inverse">Your ledger. Your numbers.</span>
            <h2>Stop guessing your average entry.</h2>
            <p>Start with one real transaction and let the portfolio rebuild itself from there.</p>
          </div>
          <div className="hero-actions">
            <Link href="/register" className="button button-white button-large">Start free</Link>
            <InstallButton className="button button-outline-white button-large" />
          </div>
        </section>

        <footer className="site-footer">
          <Link href="/" className="brand">
            <span className="brand-mark">D</span>
            <span>Crypto DCA Tracking App</span>
          </Link>
          <p>Portfolio tracking and analytics only. Not financial advice.</p>
          <div>
            <Link href="/login">Sign in</Link>
            <a href="https://github.com/curib123/Crypto-DCA-Tracking-App">GitHub</a>
          </div>
        </footer>
      </main>
    </>
  );
}
