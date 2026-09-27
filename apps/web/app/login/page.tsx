import type { Metadata } from "next";
import Link from "next/link";
import { GoogleSignIn } from "@/components/google-sign-in";

export const metadata: Metadata = {
  title: "Sign in with Google",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-heading">
          <Link href="/" className="brand">
            <span className="brand-mark">D</span>
            <span>Crypto DCA</span>
          </Link>
          <p className="eyebrow">Secure account access</p>
          <h1>Continue with Google.</h1>
          <p>
            One Google account, one portfolio workspace. No app password to create or store.
          </p>
        </div>

        <GoogleSignIn />

        <p className="auth-switch">
          By continuing, you use Google only for identity. Crypto DCA never asks for wallet seed phrases or private keys.
        </p>
      </div>
    </main>
  );
}
