/**
 * A 404 under a company or agent workspace may mean the user lost access to it
 * (spec 0012 AC36). The API client reports every 404 here; the context guards
 * decide whether it really is a lost context.
 */

export type NotFoundScope = { kind: "company" | "workspace"; id: string };

const NOT_IDS = new Set(["resolve"]);

/** The company or workspace a request path belongs to, if any. */
export function notFoundScope(path: string): NotFoundScope | null {
  const m = /^\/v1\/(companies|workspaces)\/([^/?#]+)/.exec(path);
  const raw = m?.[2];
  if (!m || !raw || NOT_IDS.has(raw)) return null;
  let id = raw;
  try {
    id = decodeURIComponent(id);
  } catch {
    // Keep the raw segment.
  }
  return { kind: m[1] === "companies" ? "company" : "workspace", id };
}

type Listener = (scope: NotFoundScope) => void;
const listeners = new Set<Listener>();

export function subscribeNotFound(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitNotFound(path: string): void {
  const scope = notFoundScope(path);
  if (!scope) return;
  for (const fn of [...listeners]) fn(scope);
}
