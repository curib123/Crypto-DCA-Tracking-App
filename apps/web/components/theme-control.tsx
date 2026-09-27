"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export type ThemePreference = "SYSTEM" | "LIGHT" | "DARK";

const STORAGE_KEY = "nextfi-theme";

function resolveTheme(preference: ThemePreference) {
  if (preference === "SYSTEM") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return preference.toLowerCase();
}

export function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  root.dataset.themePreference = preference.toLowerCase();
  root.dataset.theme = resolveTheme(preference);
  root.style.colorScheme = root.dataset.theme;
}

export function ThemeControl({
  compact = false,
  syncAccount = false,
}: {
  compact?: boolean;
  syncAccount?: boolean;
}) {
  const [preference, setPreference] = useState<ThemePreference>("SYSTEM");

  useEffect(() => {
    const saved = String(localStorage.getItem(STORAGE_KEY) || "SYSTEM").toUpperCase();
    const valid: ThemePreference =
      saved === "LIGHT" || saved === "DARK" || saved === "SYSTEM" ? saved : "SYSTEM";
    setPreference(valid);
    applyTheme(valid);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      const current = String(localStorage.getItem(STORAGE_KEY) || "SYSTEM").toUpperCase();
      if (current === "SYSTEM") applyTheme("SYSTEM");
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  async function choose(next: ThemePreference) {
    setPreference(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);

    if (syncAccount) {
      try {
        await apiFetch("/settings", {
          method: "PATCH",
          body: JSON.stringify({ themePreference: next }),
        });
      } catch {
        // Local theme still works when the device is offline or the account cannot sync.
      }
    }
  }

  return (
    <div className={compact ? "theme-control compact" : "theme-control"} aria-label="Theme">
      {(["SYSTEM", "LIGHT", "DARK"] as ThemePreference[]).map((item) => (
        <button
          key={item}
          type="button"
          className={preference === item ? "active" : undefined}
          aria-pressed={preference === item}
          onClick={() => choose(item)}
        >
          {item === "SYSTEM" ? "System" : item === "LIGHT" ? "Light" : "Dark"}
        </button>
      ))}
    </div>
  );
}
