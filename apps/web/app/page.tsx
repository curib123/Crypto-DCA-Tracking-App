import type { Metadata } from "next";
import Link from "next/link";
import { NextFiLogo } from "@/components/nextfi-logo";
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
            <Link href="/dca-calculator">DCA calculator</Link>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="header-actions">
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
              <Link href="/dca-calculator" className="button button-light button-large">{content.secondaryCtaLabel}</Link>
            </div>

            <div className="trust-row" aria-label="Product principles">
              <span>No custody</span>
              <span>No seed phrases</span>
              <span>Manual DCA tracking stays free</span>
              <span>Web · PWA · Android</span>
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
              <div><span>Total invested</span><strong>$4,088.00</strong></div>
              <div><span>Total P/L</span><strong>+$754.18</strong></div>
              <div><span>Monthly DCA</span><strong>$300.00</strong></div>
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
          <span>AVERAGE ENTRY</span>
          <span>TOTAL INVESTED</span>
          <span>PROFIT / LOSS</span>
          <span>MONTHLY TARGET</span>
          <span>NEXT DCA</span>
          <span>OFFLINE PWA</span>
        </section>

        <section className="section" id="features">
          <div className="section-heading">
            <span className="eyebrow">Built for long-term DCA</span>
            <h2>The numbers a long-term DCA investor actually checks.</h2>
            <p>How much did I put in? What is it worth? What is my average entry? Am I profitable? When do I invest again?</p>
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
            <h2>Record the purchase. NextFi handles the math.</h2>
            <p>Your real DCA history stays the source of truth, while plans and projections stay clearly separate from completed purchases.</p>
          </div>
          <div className="steps">
            <article><span>01</span><div><h3>Add your DCA purchase</h3><p>Record the coin, money amount, quantity, price and date.</p></div></article>
            <article><span>02</span><div><h3>Know your average</h3><p>NextFi recalculates weighted average entry, invested amount and profit/loss.</p></div></article>
            <article><span>03</span><div><h3>Set your DCA plan</h3><p>Choose weekly, biweekly or monthly contributions and see your next planned date.</p></div></article>
            <article><span>04</span><div><h3>See your progress</h3><p>Compare this month’s real purchases with your target and see how the habit adds up over time.</p></div></article>
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
            <span className="eyebrow inverse">One purchase at a time.</span>
            <h2>Track your DCA without the trading-terminal noise.</h2>
            <p>Record real purchases, know your average entry and see whether you are on pace for the month.</p>
          </div>
          <div className="hero-actions">
            <Link href="/login" className="button button-white button-large">Start tracking free</Link>
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
