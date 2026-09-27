"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdConfig =
  | {
      enabled: true;
      clientId: string;
      slotId: string;
      placement: "app" | "landing";
    }
  | {
      enabled: false;
      placement: "app" | "landing";
    };

function ensureAdSenseScript(clientId: string) {
  const id = "nextfi-adsense-script";
  const existing = document.getElementById(id) as HTMLScriptElement | null;

  if (existing) {
    return new Promise<void>((resolve) => {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }

      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => resolve(), { once: true });
    });
  }

  return new Promise<void>((resolve) => {
    const script = document.createElement("script");
    script.id = id;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src =
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" +
      encodeURIComponent(clientId);

    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener("error", () => resolve(), { once: true });
    document.head.appendChild(script);
  });
}

export function AdSenseSlot({
  placement,
}: {
  placement: "app" | "landing";
}) {
  const [config, setConfig] = useState<AdConfig | null>(null);
  const rendered = useRef(false);

  useEffect(() => {
    let mounted = true;
    const path = placement === "app" ? "/ads/app" : "/ads/public";

    apiFetch<AdConfig>(path, {}, placement === "app")
      .then((value) => {
        if (mounted) setConfig(value);
      })
      .catch(() => {
        if (mounted) {
          setConfig({ enabled: false, placement });
        }
      });

    return () => {
      mounted = false;
    };
  }, [placement]);

  useEffect(() => {
    if (!config?.enabled || rendered.current) return;

    let cancelled = false;

    ensureAdSenseScript(config.clientId).then(() => {
      if (cancelled || rendered.current) return;

      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        rendered.current = true;
      } catch {
        // AdSense may reject a request while the account/site is still under review.
      }
    });

    return () => {
      cancelled = true;
    };
  }, [config]);

  if (!config?.enabled) return null;

  return (
    <aside
      className={"adsense-placement adsense-" + placement}
      aria-label="Advertisement"
    >
      <span className="ad-label">Advertisement</span>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={config.clientId}
        data-ad-slot={config.slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
