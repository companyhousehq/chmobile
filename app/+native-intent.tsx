import { parseLink, rewriteEmailPath, routeHref } from "@/lib/links";
import { stashLinkToken } from "@/lib/auth/tokenStore";

/**
 * Link tokens never enter router state (design 7, spec 0011 R14): the token is
 * parked in the secure store and the path is rewritten without its query. The
 * receiving screen reads and removes it. Paths from notification emails are mapped to their screens; other links pass through unchanged.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  const link = parseLink(path);
  if (!link) return rewriteEmailPath(path) ?? path;
  if (link.token) {
    try {
      stashLinkToken(link.route === "invitation" ? "invitation" : "email", link.route, link.token);
    } catch {
      // Without the store the screen simply asks for a new link.
    }
  }
  return routeHref(link.route);
}
