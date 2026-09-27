"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { NextFiLogo } from "@/components/nextfi-logo";

type ControlAdmin = {
  id: string;
  username: string;
  mustChangePassword: boolean;
};

export function AdminChangePasswordClient() {
  const router = useRouter();
  const [admin, setAdmin] = useState<ControlAdmin | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<ControlAdmin>("/admin-auth/me")
      .then((value) => {
        setAdmin(value);
        if (!value.mustChangePassword) router.replace("/admin");
      })
      .catch(() => router.replace("/admin/login"));
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (newPassword !== confirm) {
      setError("New passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      await apiFetch("/admin-auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card control-login-card">
        <div className="auth-heading">
          <div className="brand">
            <NextFiLogo />
            <span>NextFi Control</span>
          </div>
          <p className="eyebrow">Required security step</p>
          <h1>Change the bootstrap password</h1>
          <p>
            {admin ? "Signed in as " + admin.username + ". " : ""}
            Use at least 12 characters with uppercase, lowercase, a number, and a symbol.
          </p>
        </div>

        <form className="stack-form" onSubmit={submit}>
          <label>
            <span>Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </label>

          <label>
            <span>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={12}
              required
            />
          </label>

          <label>
            <span>Confirm new password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              minLength={12}
              required
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button
            type="submit"
            className="button button-dark button-wide"
            disabled={busy}
          >
            {busy ? "Saving…" : "Set secure password"}
          </button>
        </form>
      </section>
    </main>
  );
}
