export type NavIconName =
  | "home"
  | "portfolio"
  | "ledger"
  | "market"
  | "insights"
  | "settings"
  | "profile"
  | "plus"
  | "calendar"
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
  { href: "/app", label: "Home", icon: "home" },
  { href: "/app/portfolio", label: "Portfolio", icon: "portfolio" },
  { href: "/app/transactions", label: "History", icon: "ledger" },
  { href: "/app/dca-plans", label: "DCA plan", icon: "calendar" },
  { href: "/app/settings", label: "Profile", icon: "profile" },
];

export const MOBILE_NAVIGATION: NavigationItem[] = [
  { href: "/app", label: "Home", icon: "home" },
  { href: "/app/portfolio", label: "Portfolio", icon: "portfolio" },
  { href: "/app/transactions", label: "History", icon: "ledger" },
  { href: "/app/settings", label: "Profile", icon: "profile" },
];

export const CONTROL_NAVIGATION: NavigationItem[] = [
  { href: "/admin", label: "Overview", icon: "home" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/ads", label: "AdSense", icon: "ads" },
  { href: "/admin/content", label: "Landing CMS", icon: "content" },
  { href: "/admin/audit", label: "Audit log", icon: "audit" },
];
