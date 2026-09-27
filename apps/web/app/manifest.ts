import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "NextFi — Crypto DCA Tracking",
    short_name: "NextFi",
    description:
      "Track crypto DCA investments, weighted average cost, break-even, portfolio value and P/L.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f7f7f5",
    theme_color: "#090909",
    orientation: "portrait-primary",
    categories: ["finance", "productivity", "utilities"],
    shortcuts: [
      {
        name: "Add transaction",
        short_name: "Add",
        description: "Record a crypto transaction in NextFi",
        url: "/app/transactions?action=add",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Portfolio",
        short_name: "Portfolio",
        description: "Open your crypto portfolio",
        url: "/app/portfolio",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "DCA plans",
        short_name: "DCA Plans",
        description: "Review your DCA contribution plans",
        url: "/app/dca-plans",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
