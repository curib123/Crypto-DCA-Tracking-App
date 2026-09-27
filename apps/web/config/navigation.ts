export type NavIconName =
  | "home"
  | "ledger"
  | "market"
  | "insights"
  | "settings"
  | "users"
  | "ads"
  | "content"
  | "audit";

export type NavigationItem = {
  href: string;
  label: string;
  mobileLabel?: string;
  icon: NavIconName;
};

export const APP_NAVIGATION: NavigationItem[] = [
  { href: "/app", label: "Overview", mobileLabel: "Home", icon: "home" },
  { href: "/app/transactions", label: "Transactions", mobileLabel: "Ledger", icon: "ledger" },
  { href: "/app/market", label: "Market", icon: "market" },
  { href: "/app/insights", label: "AI Insights", mobileLabel: "Insights", icon: "insights" },
  { href: "/app/settings", label: "Settings", icon: "settings" },
];

export const CONTROL_NAVIGATION: NavigationItem[] = [
  { href: "/admin", label: "Overview", icon: "home" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/ads", label: "AdSense", icon: "ads" },
  { href: "/admin/content", label: "Landing CMS", icon: "content" },
  { href: "/admin/audit", label: "Audit log", icon: "audit" },
];
