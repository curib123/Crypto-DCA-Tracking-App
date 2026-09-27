import type { Metadata } from "next";
import Link from "next/link";
import { InstallButton } from "@/components/install-button";
import { NextFiLogo } from "@/components/nextfi-logo";
import { ThemeControl } from "@/components/theme-control";
import { AdSenseSlot } from "@/components/adsense-slot";
import { getLandingContent } from "@/lib/landing";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getLandingContent();
  return {
    title: content.seoTitle,
    description: content.seoDescription,
    alternates: { canonical: "/" },
    openGraph: {
      title: content.seoTitle,
      description: content.seoDescription,
      url: "/",
      siteName: "NextFi",
      type: "website",
    },
  };
}

export default async function LandingPage() {
  const content = await getLandingContent();

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "NextFi",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web, Android, iOS, Windows, macOS",
    url: siteUrl,
    description: content.seoDescription,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: content.features.map((feature) => feature.title),
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <main className="landing">
        <header className="site-header">
          <Link href="/" className="brand" aria-label="NextFi home">
            <NextFiLogo />
            <span>{content.brandName}</span>
          </Link>

          <nav className="site-nav" aria-label="Main navigation">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="header-actions">
            <ThemeControl compact />
            <Link href="/login" className="button button-ghost">Sign in</Link>
            <Link href="/login" className="button button-dark">Start free</Link>
          </div>
        </header>

        <section className="hero-section">
          <div className="hero-copy">
            <div className="announcement">
              <span className="announcement-dot" />
              {content.announcement}
            </div>
            <p className="eyebrow hero-eyebrow">{content.heroEyebrow}</p>
            <h1>{content.heroTitle}</h1>
            <p className="hero-lead">{content.heroDescription}</p>

            <div className="hero-actions">
              <Link href="/login" className="button button-dark button-large">{content.primaryCtaLabel}</Link>
              <InstallButton className="button button-light button-large" label={content.secondaryCtaLabel} />
            </div>

            <div className="trust-row" aria-label="Product principles">
              <span>No custody</span>
              <span>No seed phrases</span>
              <span>Ledger-based accounting</span>
              <span>AI has no trading access</span>
            </div>
          </div>

          <div className="product-preview" aria-label="NextFi dashboard preview">
            <div className="preview-brand">
              <NextFiLogo />
              <span>{content.brandName}</span>
            </div>
            <div className="preview-top">
              <div>
                <span className="eyebrow">Portfolio value</span>
                <strong>$4,842.18</strong>
              </div>
              <span className="preview-chip">+18.42%</span>
            </div>
            <div className="preview-stats">
              <div><span>Actual invested</span><strong>$4,088.00</strong></div>
              <div><span>Lifetime P/L</span><strong>+$754.18</strong></div>
              <div><span>Fees tracked</span><strong>$22.64</strong></div>
            </div>
            <div className="preview-bars" aria-hidden="true">
              <span style={{ height: "38%" }} />
              <span style={{ height: "52%" }} />
              <span style={{ height: "47%" }} />
              <span style={{ height: "66%" }} />
              <span style={{ height: "61%" }} />
              <span style={{ height: "78%" }} />
              <span style={{ height: "92%" }} />
            </div>
            <div className="preview-position">
              <div className="coin-dot">B</div>
              <div><strong>Bitcoin</strong><span>0.042318 BTC</span></div>
              <div className="preview-position-right"><span>Avg. entry</span><strong>$81,420</strong></div>
            </div>
          </div>
        </section>

        <section className="logo-strip" aria-label="Core tracking capabilities">
          <span>AVERAGE COST</span>
          <span>BREAK-EVEN</span>
          <span>REALIZED P/L</span>
          <span>UNREALIZED P/L</span>
          <span>AI INSIGHTS</span>
          <span>OFFLINE PWA</span>
        </section>

        <section className="section" id="features">
          <div className="section-heading">
            <span className="eyebrow">Built for long-term DCA</span>
            <h2>Useful analytics without turning investing into a trading terminal.</h2>
            <p>NextFi uses your transaction ledger as the source of truth and adds market data only where it helps explain the position.</p>
          </div>
          <div className="feature-grid">
            {content.features.map((feature, index) => (
              <article className="feature-card" key={`${feature.title}-${index}`}>
                <span className="feature-index">{String(index + 1).padStart(2, "0")}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section split-section" id="how-it-works">
          <div className="section-heading sticky-heading">
            <span className="eyebrow">How it works</span>
            <h2>Record once. Recalculate everything.</h2>
            <p>Transactions remain the source of truth; charts and AI explanations are derived from those deterministic calculations.</p>
          </div>
          <div className="steps">
            <article><span>01</span><div><h3>Record the transaction</h3><p>Add the actual amount, quantity, fees, currency and date.</p></div></article>
            <article><span>02</span><div><h3>Rebuild cost basis</h3><p>NextFi calculates weighted average cost, break-even and remaining basis.</p></div></article>
            <article><span>03</span><div><h3>Layer market data</h3><p>Current prices produce portfolio value and unrealized performance without changing the ledger.</p></div></article>
            <article><span>04</span><div><h3>Explain the data</h3><p>Focused charts and optional AI-assisted text turn the numbers into understandable observations.</p></div></article>
          </div>
        </section>

        <section className="section" id="faq">
          <div className="section-heading">
            <span className="eyebrow">FAQ</span>
            <h2>Clear answers before you install.</h2>
          </div>
          <div className="faq-grid">
            {content.faq.map((item, index) => (
              <details key={`${item.question}-${index}`} open={index === 0}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <AdSenseSlot placement="landing" />

        <section className="final-cta">
          <div>
            <span className="eyebrow inverse">Your ledger. Your numbers.</span>
            <h2>Track DCA with less guesswork.</h2>
            <p>Install NextFi, record your real transactions and keep the analytics explainable.</p>
          </div>
          <div className="hero-actions">
            <Link href="/app" className="button button-white button-large">Open NextFi</Link>
          </div>
        </section>

        <footer className="site-footer">
          <Link href="/" className="brand">
            <NextFiLogo />
            <span>{content.brandName}</span>
          </Link>
          <p>{content.footerText}</p>
          <div>
            <Link href="/login">Sign in</Link>
            <a href="https://github.com/curib123/Crypto-DCA-Tracking-App">GitHub</a>
          </div>
        </footer>
      </main>
    </>
  );
}
