import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const themeBootstrap = `
(() => {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const applySystemTheme = () => {
    const theme = media.matches ? "dark" : "light";
    document.documentElement.dataset.themePreference = "system";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  };

  try {
    localStorage.removeItem("nextfi-theme");
  } catch {}

  applySystemTheme();
  media.addEventListener?.("change", applySystemTheme);
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
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#08111f" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className={inter.variable}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
