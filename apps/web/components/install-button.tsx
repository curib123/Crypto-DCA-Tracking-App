"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { AppModal } from "@/components/ui/app-modal";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const fallbackApkUrl =
  "https://github.com/curib123/Crypto-DCA-Tracking-App/releases/download/android-latest/NextFi-android.apk";

export function InstallButton({
  className = "button button-dark",
  label = "Get the app",
}: {
  className?: string;
  label?: string;
}) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [nativeApp, setNativeApp] = useState(false);
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState("");

  const apkUrl = process.env.NEXT_PUBLIC_ANDROID_APK_URL || fallbackApkUrl;

  useEffect(() => {
    setNativeApp(Capacitor.isNativePlatform());

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone;

    setInstalled(Boolean(standalone));

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setHint("NextFi is installed on this device.");
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function installPwa() {
    if (installed) {
      setHint("NextFi is already installed as a PWA.");
      return;
    }

    if (!promptEvent) {
      setHint("Use your browser menu and choose Install app or Add to Home screen.");
      return;
    }

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    setHint(choice.outcome === "accepted" ? "NextFi is being installed." : "Install cancelled.");
  }

  if (nativeApp) return null;

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>

      <AppModal
        open={open}
        title="Choose how to use NextFi"
        eyebrow="Install"
        description="Use the browser, install the PWA, or download the Android APK. Your account and portfolio stay the same."
        size="md"
        onClose={() => {
          setOpen(false);
          setHint("");
        }}
      >
        <div className="install-choice-grid">
          <article className="install-choice">
            <div>
              <span className="eyebrow">PWA</span>
              <h3>Install from browser</h3>
              <p>Fast home-screen install with offline reading and queued transactions.</p>
            </div>
            <button type="button" className="button button-dark button-wide" onClick={() => void installPwa()}>
              {installed ? "PWA installed" : "Install PWA"}
            </button>
          </article>

          <article className="install-choice">
            <div>
              <span className="eyebrow">Android</span>
              <h3>Download APK</h3>
              <p>Native Capacitor shell with the same Next.js UI and deployed backend.</p>
            </div>
            <a className="button button-light button-wide" href={apkUrl}>
              Download APK
            </a>
          </article>
        </div>

        {hint && <p className="install-hint" role="status">{hint}</p>}
      </AppModal>
    </>
  );
}
