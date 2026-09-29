"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { GoogleSignIn as NativeGoogleSignIn } from "@capawesome/capacitor-google-sign-in";
import { apiFetch } from "@/lib/api";
import { clearLogoutPending, setActiveUser } from "@/lib/offline";

type AuthResponse = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    pictureUrl?: string | null;
    baseCurrency: string;
  };
};

type GoogleCredentialResponse = {
  credential: string;
};

type GoogleAccounts = {
  id: {
    initialize: (options: {
      client_id: string;
      callback: (response: GoogleCredentialResponse) => void;
      auto_select?: boolean;
    }) => void;
    renderButton: (
      element: HTMLElement,
      options: {
        theme?: string;
        size?: string;
        shape?: string;
        text?: string;
        width?: number;
      },
    ) => void;
  };
};

declare global {
  interface Window {
    google?: {
      accounts: GoogleAccounts;
    };
  }
}

export function GoogleSignIn() {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [nativeApp, setNativeApp] = useState(false);
  const [nativeReady, setNativeReady] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  const handleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      if (!response.credential) {
        setError("Google did not return a sign-in credential.");
        return;
      }

      setBusy(true);
      setError("");

      try {
        const result = await apiFetch<AuthResponse>(
          "/auth/google",
          {
            method: "POST",
            body: JSON.stringify({ credential: response.credential }),
          },
          false,
        );

        await clearLogoutPending();
        await setActiveUser({
          id: result.user.id,
          email: result.user.email,
          baseCurrency: result.user.baseCurrency,
        });

        router.push("/app");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Google sign-in failed.");
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  const initializeGoogleWeb = useCallback(() => {
    if (!clientId || !window.google || !buttonRef.current) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential,
      auto_select: false,
    });

    buttonRef.current.innerHTML = "";

    const width = Math.max(
      240,
      Math.min(420, Math.floor(buttonRef.current.getBoundingClientRect().width || 360)),
    );

    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      width,
    });
  }, [clientId, handleCredential]);

  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    setNativeApp(isNative);

    if (!isNative) {
      if (window.google) initializeGoogleWeb();
      return;
    }

    if (!clientId) return;

    void NativeGoogleSignIn.initialize({ clientId })
      .then(() => setNativeReady(true))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not initialize Google Sign-In."));
  }, [clientId, initializeGoogleWeb]);

  async function signInNative() {
    if (!clientId || !nativeReady || busy) return;

    setBusy(true);
    setError("");

    try {
      const result = await NativeGoogleSignIn.signIn();
      await handleCredential({ credential: result.idToken });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in was cancelled or failed.");
      setBusy(false);
    }
  }

  return (
    <div className="google-auth">
      {!nativeApp && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={initializeGoogleWeb}
        />
      )}

      {!clientId ? (
        <div className="form-error" role="alert">
          Google Sign-In is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID.
        </div>
      ) : nativeApp ? (
        <button
          type="button"
          className="button button-light button-wide native-google-button"
          onClick={() => void signInNative()}
          disabled={!nativeReady || busy}
        >
          {busy ? "Signing in…" : nativeReady ? "Continue with Google" : "Preparing Google Sign-In…"}
        </button>
      ) : (
        <div className={busy ? "google-button is-busy" : "google-button"} ref={buttonRef} />
      )}

      {busy && <p className="auth-status">Verifying your Google account…</p>}
      {error && <div className="form-error" role="alert">{error}</div>}
    </div>
  );
}
