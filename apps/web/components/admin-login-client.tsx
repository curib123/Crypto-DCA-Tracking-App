"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { NextFiLogo } from "@/components/nextfi-logo";

type LoginResponse = {
  admin: {
    id: string;
    username: string;
    mustChangePassword: boolean;
  };
};

export function AdminLoginClient() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const result = await apiFetch<LoginResponse>("/admin-auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      router.replace(
        result.admin.mustChangePassword
          ? "/admin/change-password"
          : "/admin",
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card control-login-card">
        <div className="auth-heading">
          <div className="auth-brand-row">
            <Link href="/" className="brand">
              <NextFiLogo />
              <span>NextFi Control</span>
            </Link>
          </div>
          <p className="eyebrow">Restricted administration</p>
          <h1>Control panel login</h1>
          <p>
            This session is separate from customer Google sign-in and uses a short-lived, HttpOnly control-panel cookie.
          </p>
        </div>

        <form className="stack-form" onSubmit={submit}>
          <label>
            <span>Username</span>
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              maxLength={80}
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              maxLength={256}
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button
            type="submit"
            className="button button-dark button-wide"
            disabled={busy}
          >
            {busy ? "Checking…" : "Unlock control panel"}
          </button>
        </form>
      </section>
    </main>
  );
}
