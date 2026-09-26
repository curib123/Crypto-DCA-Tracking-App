"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api";

type AuthResponse = {
  accessToken: string;
  user: { id: string; email: string; baseCurrency: string };
};

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    const form = new FormData(event.currentTarget);
    const payload: Record<string, string> = {
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
    };

    if (mode === "register") {
      payload.baseCurrency = String(form.get("baseCurrency") || "USD");
    }

    try {
      const result = await apiFetch<AuthResponse>(
        `/auth/${mode === "register" ? "register" : "login"}`,
        { method: "POST", body: JSON.stringify(payload) },
        false,
      );

      localStorage.setItem("crypto-dca-token", result.accessToken);
      localStorage.setItem("crypto-dca-user", JSON.stringify(result.user));
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-heading">
        <Link href="/" className="brand">
          <span className="brand-mark">D</span>
          <span>Crypto DCA</span>
        </Link>
        <p className="eyebrow">{mode === "login" ? "Welcome back" : "Create your workspace"}</p>
        <h1>{mode === "login" ? "Sign in to your portfolio." : "Start tracking your real DCA cost."}</h1>
        <p>
          {mode === "login"
            ? "Your transactions stay the source of truth."
            : "Track contributions, average entry, break-even and profit/loss in one clean view."}
        </p>
      </div>

      <form className="stack-form" onSubmit={submit}>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        </label>

        <label>
          Password
          <input
            name="password"
            type="password"
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            placeholder="Minimum 8 characters"
          />
        </label>

        {mode === "register" && (
          <label>
            Base currency
            <select name="baseCurrency" defaultValue="USD">
              {["USD","PHP","EUR","GBP","AUD","CAD","SGD","JPY","KRW","MYR","IDR","THB","USDT","USDC"].map(
                (currency) => <option key={currency} value={currency}>{currency}</option>,
              )}
            </select>
          </label>
        )}

        {error && <div className="form-error" role="alert">{error}</div>}

        <button className="button button-dark button-wide" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="auth-switch">
        {mode === "login" ? "New here?" : "Already have an account?"}{" "}
        <Link href={mode === "login" ? "/register" : "/login"}>
          {mode === "login" ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </div>
  );
}
