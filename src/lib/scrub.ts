/**
 * Removes anything personal or secret from crash events before they leave the
 * device (design 10.1): bodies, headers, cookies, query strings, UUIDs and
 * token-shaped strings. Pure and structural so it can be tested without Sentry.
 */

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const SESSION_TOKEN = /\bchs_[A-Za-z0-9_-]+/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const LONG_TOKEN = /\b[A-Za-z0-9_-]{32,}\b/g;
const BEARER = /Bearer\s+\S+/gi;

export function scrubString(text: string): string {
  return text
    .replace(BEARER, "Bearer [token]")
    .replace(SESSION_TOKEN, "[token]")
    .replace(UUID, ":id")
    .replace(EMAIL, "[email]")
    .replace(LONG_TOKEN, "[token]");
}

export function scrubUrl(url: string): string {
  return scrubString(url.split("#")[0]!.split("?")[0]!);
}

const DROPPED_KEYS = new Set([
  "data",
  "body",
  "headers",
  "cookies",
  "cookie",
  "query_string",
  "extra",
  "user",
  "request_body",
  "response_body",
]);

function scrubValue(value: unknown, key?: string): unknown {
  if (typeof value === "string") {
    return key === "url" || key === "from" || key === "to" ? scrubUrl(value) : scrubString(value);
  }
  if (Array.isArray(value)) return value.map((v) => scrubValue(v));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (DROPPED_KEYS.has(k)) continue;
      out[k] = scrubValue(v, k);
    }
    return out;
  }
  return value;
}

export function scrubEvent<T extends object>(event: T): T {
  const copy = scrubValue(event) as Record<string, unknown>;
  const contexts = copy.contexts as Record<string, Record<string, unknown>> | undefined;
  if (contexts?.device) delete contexts.device.name;
  return copy as T;
}

/** Returns null to drop the breadcrumb (console crumbs can carry anything). */
export function scrubBreadcrumb<T extends { category?: string }>(crumb: T): T | null {
  if (crumb.category === "console") return null;
  return scrubValue(crumb) as T;
}
