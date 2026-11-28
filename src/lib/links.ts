/**
 * Incoming links (design 7). Pure: parses a universal link or custom-scheme
 * URL and says where the app should go and which token to park. The token
 * never stays in the path, so it cannot reach router state, history or
 * breadcrumbs (spec 0011 R14).
 */

export type LinkRoute = "verify-email" | "reset-password" | "confirm-email-change" | "invitation";

export interface ParsedLink {
  route: LinkRoute;
  token: string | null;
}

const PATHS: Record<string, LinkRoute> = {
  "/verify-email": "verify-email",
  "/reset-password": "reset-password",
  "/confirm-email-change": "confirm-email-change",
  "/invitations/accept": "invitation",
};

function splitUrl(input: string): { path: string; query: string } {
  let rest = input.replace(/#.*$/, "");
  // Universal links carry a host to drop; in the custom scheme the "host" is the first path segment.
  rest = /^https?:\/\//i.test(rest)
    ? rest.replace(/^https?:\/\/[^/?]*/i, "")
    : rest.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "/");
  const q = rest.indexOf("?");
  const path = (q === -1 ? rest : rest.slice(0, q)).replace(/\/+$/, "") || "/";
  return {
    path: path.startsWith("/") ? path : `/${path}`,
    query: q === -1 ? "" : rest.slice(q + 1),
  };
}

function queryToken(query: string): string | null {
  for (const pair of query.split("&")) {
    const [k, v = ""] = pair.split("=");
    if (k === "token") {
      try {
        const t = decodeURIComponent(v.replace(/\+/g, " "));
        return t.length > 0 && t.length <= 512 ? t : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Null for any link that is not a token route (the router handles those as usual). */
export function parseLink(input: string): ParsedLink | null {
  const { path, query } = splitUrl(input);
  const route = PATHS[path];
  return route ? { route, token: queryToken(query) } : null;
}

/** Where each token route lives in the app. The invitation screen sits in the signed-in group. */
export function routeHref(route: LinkRoute): string {
  return route === "invitation" ? "/invitation" : `/${route}`;
}

/**
 * Paths the API puts in notification emails (access/jobs.go, identity jobs)
 * that are web routes, mapped to their screens in the app. Context switching
 * needs nothing more: opening `/c/{id}/...` or `/w/{id}/...` remembers that
 * context, and a context the user has lost is dropped by its guard.
 */
const EMAIL_PATHS: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^\/c\/([^/]+)\/authorizations$/, (m) => `/c/${m[1]}/agents`],
  [/^\/w\/([^/]+)\/companies$/, (m) => `/w/${m[1]}/clients?tab=requests`],
  [/^\/w\/([^/]+)\/settings\/(?:verification|capabilities)$/, (m) => `/w/${m[1]}/workspace`],
  [/^\/account\/security$/, () => "/security"],
];

/** The app path for an emailed web path, or null when the link needs no rewrite. */
export function rewriteEmailPath(input: string): string | null {
  const { path } = splitUrl(input);
  for (const [re, to] of EMAIL_PATHS) {
    const m = re.exec(path);
    if (m) return to(m);
  }
  return null;
}
