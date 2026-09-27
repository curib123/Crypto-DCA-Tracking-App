import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const themeBootstrap = `
(() => {
  try {
    const saved = (localStorage.getItem("nextfi-theme") || "SYSTEM").toUpperCase();
    const preference = ["SYSTEM", "LIGHT", "DARK"].includes(saved) ? saved : "SYSTEM";
    const dark = preference === "DARK" || (preference === "SYSTEM" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.themePreference = preference.toLowerCase();
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch {
    const dark = matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.themePreference = "system";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "NextFi — Crypto DCA Tracking & Portfolio Analytics",
    template: "%s | NextFi",
  },
  description:
    "Track crypto DCA investments, weighted average cost, break-even, fees, portfolio value and profit/loss in the installable NextFi PWA.",
  applicationName: "NextFi",
  category: "finance",
  keywords: [
    "NextFi",
    "crypto DCA tracker",
    "crypto average buy price",
    "bitcoin DCA tracker",
    "crypto break even calculator",
    "crypto portfolio tracker",
    "DCA investment tracker",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "NextFi",
    title: "NextFi — Crypto DCA Tracking",
    description:
      "Track real DCA contributions, average cost, break-even and portfolio performance.",
  },
  twitter: {
    card: "summary",
    title: "NextFi — Crypto DCA Tracking",
    description:
      "A clean DCA tracker for real contributions, weighted average cost, break-even and P/L.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#090909" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
