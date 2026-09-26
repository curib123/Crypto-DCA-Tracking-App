import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Crypto DCA Tracking App",
    short_name: "Crypto DCA",
    description:
      "Track actual crypto DCA investments, weighted average entry, break-even and portfolio P/L.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f7f7f5",
    theme_color: "#050505",
    orientation: "portrait-primary",
    categories: ["finance", "productivity", "utilities"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
