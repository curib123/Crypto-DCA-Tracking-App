export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("crypto-dca-token") || "";
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (authenticated) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = Array.isArray(payload?.message)
      ? payload.message.join(", ")
      : payload?.message || "Request failed";
    throw new Error(message);
  }

  return payload as T;
}

export function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "BTC" ? 8 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
}
