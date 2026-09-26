"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallButton({ className = "button button-dark" }: { className?: string }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
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
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (installed) return;

    if (!promptEvent) {
      alert(
        "To install: open your browser menu and choose Add to Home Screen or Install App. On iPhone/iPad, use Share → Add to Home Screen.",
      );
      return;
    }

    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  }

  return (
    <button type="button" className={className} onClick={install}>
      {installed ? "Installed" : "Install PWA"}
    </button>
  );
}
