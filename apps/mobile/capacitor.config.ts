import type { CapacitorConfig } from "@capacitor/cli";

const productionUrl = process.env.CAPACITOR_SERVER_URL || "https://web-nextfi.vercel.app";

const config: CapacitorConfig = {
  appId: "com.curibtech.nextfi",
  appName: "NextFi",
  webDir: "www",
  server: {
    url: productionUrl,
    cleartext: productionUrl.startsWith("http://"),
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: process.env.NODE_ENV !== "production",
  },
};

export default config;
