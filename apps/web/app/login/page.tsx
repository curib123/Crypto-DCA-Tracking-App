import type { Metadata } from "next";
import Link from "next/link";
import { GoogleSignIn } from "@/components/google-sign-in";
import { NextFiLogo } from "@/components/nextfi-logo";

export const metadata: Metadata = {
  title: "Sign in with Google",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="auth-page auth-page-nextfi">
      <section className="auth-shell">
        <aside className="auth-visual" aria-label="NextFi product introduction">
          <Link href="/" className="brand auth-visual-brand" aria-label="NextFi home">
            <NextFiLogo />
            <span>NextFi</span>
          </Link>

          <div className="auth-visual-copy">
            <span className="auth-kicker">DCA · PORTFOLIO · INSIGHTS</span>
            <h1>Invest with context, not clutter.</h1>
            <p>
              Track your crypto DCA, average cost, break-even and portfolio performance
              in one focused workspace.
            </p>
          </div>

          <div className="auth-preview" aria-hidden="true">
            <div className="auth-preview-head">
              <span>Portfolio overview</span>
              <span className="auth-preview-live">Live</span>
            </div>
            <strong>$4,842.18</strong>
            <span className="auth-preview-gain">+18.42% lifetime</span>
            <div className="auth-preview-bars">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>

          <div className="auth-trust-row">
            <span>Private portfolio</span>
            <span>No wallet custody</span>
            <span>Google identity</span>
          </div>
        </aside>

        <section className="auth-panel">
          <div className="auth-mobile-brand">
            <Link href="/" className="brand" aria-label="NextFi home">
              <NextFiLogo />
              <span>NextFi</span>
            </Link>
          </div>

          <div className="auth-panel-inner">
            <Link href="/" className="auth-back-link" aria-label="Back to NextFi home">
              <span aria-hidden="true">←</span>
              <span>Back to home</span>
            </Link>

            <div className="auth-heading auth-heading-modern">
              <p className="eyebrow">Secure account access</p>
              <h1>Welcome to NextFi.</h1>
              <p>
                Sign in with Google to open your private DCA tracking workspace.
              </p>
            </div>

            <GoogleSignIn />

            <div className="auth-security-note">
              <span className="auth-security-icon" aria-hidden="true">✓</span>
              <div>
                <strong>Simple and secure</strong>
                <p>No separate password, wallet connection, seed phrase or private key required.</p>
              </div>
            </div>
          </div>

          <footer className="auth-footer">
            <span>By continuing, you agree to NextFi&apos;s</span>
            <div>
              <Link href="/terms">Terms</Link>
              <span>·</span>
              <Link href="/privacy">Privacy</Link>
            </div>
          </footer>
        </section>
      </section>
    </main>
  );
}
