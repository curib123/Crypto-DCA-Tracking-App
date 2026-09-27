import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Crypto DCA Tracking App — Track Average Buy Price & Break-Even",
    template: "%s | Crypto DCA Tracking App",
  },
  description:
    "Track crypto DCA investments, actual money invested, weighted average buy price, break-even, portfolio value, fees and profit/loss in a clean installable PWA.",
  applicationName: "Crypto DCA Tracking App",
  category: "finance",
  keywords: [
    "crypto DCA tracker",
    "crypto average buy price",
    "bitcoin DCA tracker",
    "crypto break even calculator",
    "crypto portfolio tracker",
    "DCA investment tracker",
    "bitcoin average cost tracker",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Crypto DCA Tracking App",
    title: "Crypto DCA Tracking App",
    description:
      "Track every crypto DCA contribution, average entry, break-even and real portfolio performance.",
  },
  twitter: {
    card: "summary",
    title: "Crypto DCA Tracking App",
    description:
      "A clean crypto DCA tracker for real contributions, average cost, break-even and P/L.",
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
  themeColor: "#050505",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
