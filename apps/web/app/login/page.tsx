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
    <main className="auth-page auth-login-page">
      <section className="login-brand-panel" aria-label="About NextFi">
        <Link href="/" className="brand login-brand" aria-label="NextFi home">
          <NextFiLogo />
          <span>NextFi</span>
        </Link>

        <div className="login-brand-copy">
          <div className="login-brand-status">
            <span className="login-status-dot" />
            DCA portfolio workspace
          </div>
          <h1>Build your position.<br />Know your numbers.</h1>
          <p>
            Track every crypto buy, weighted average cost, break-even and portfolio performance
            without turning your investing routine into a trading terminal.
          </p>

          <div className="login-feature-list" aria-label="NextFi benefits">
            <div><span>01</span><strong>Ledger-based tracking</strong><small>Your transactions stay the source of truth.</small></div>
            <div><span>02</span><strong>Clear DCA analytics</strong><small>Average cost, fees and P/L in one place.</small></div>
            <div><span>03</span><strong>Private by design</strong><small>No wallet seed phrases or private keys.</small></div>
          </div>
        </div>

        <div className="login-brand-foot">
          <span>NextFi Software</span>
          <span>Crypto DCA Tracking</span>
        </div>
      </section>

      <section className="login-access-panel">
        <div className="login-access-shell">
          <div className="login-mobile-top">
            <Link href="/" className="brand" aria-label="NextFi home">
              <NextFiLogo />
              <span>NextFi</span>
            </Link>
            <Link href="/" className="login-back-link">Back</Link>
          </div>

          <div className="login-access-content">
            <div className="login-symbol" aria-hidden="true">
              <NextFiLogo />
            </div>
            <p className="eyebrow">Welcome to NextFi</p>
            <h1>Sign in to your portfolio.</h1>
            <p className="login-lead">
              Continue with Google to securely access your synchronized DCA portfolio across web,
              PWA and Android.
            </p>

            <GoogleSignIn />

            <div className="login-security-note">
              <span className="login-status-dot" />
              <div>
                <strong>Secure account access</strong>
                <span>Google is used for identity only. NextFi never asks for wallet credentials.</span>
              </div>
            </div>
          </div>

          <p className="login-legal">
            By continuing, you agree to the <Link href="/terms">Terms</Link> and acknowledge the{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
