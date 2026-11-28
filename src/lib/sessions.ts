import type { SessionItem } from "./types";

/** "iPhone app", "Android app" or the browser for web sessions (spec 0012 M5). */
export function clientLabel(s: Pick<SessionItem, "client_platform" | "user_agent">): string {
  if (s.client_platform === "ios") return "iPhone app";
  if (s.client_platform === "android") return "Android app";
  const ua = s.user_agent ?? "";
  if (/^CompanyHouse\/.*\(ios/i.test(ua)) return "iPhone app";
  if (/^CompanyHouse\/.*\(android/i.test(ua)) return "Android app";
  if (!ua) return "Web";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : null;
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? "Web";
}

/** Newest activity first; this device is always listed first. */
export function sortSessions(items: SessionItem[]): SessionItem[] {
  return [...items].sort(
    (a, b) =>
      Number(b.current) - Number(a.current) ||
      Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at),
  );
}

export function formatWhen(iso: string, now = new Date()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const mins = Math.floor((now.getTime() - t) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)} h ago`;
  return new Date(t).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
