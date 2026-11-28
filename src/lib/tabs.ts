import { COMPANY_AUTH_PERM, WS_AUTH_PERM } from "./authorizations";
import { CPERM } from "./company";
import { PERM } from "./workspace";

/**
 * Tabs the member may not use are hidden (spec 0011 R6). The API still decides.
 * While the permissions are unknown (still loading, or failed) nothing is hidden.
 */
const hasAny = (perms: readonly string[], keys: readonly string[]) =>
  keys.some((k) => perms.includes(k));

export function hiddenCompanyTabs(perms: readonly string[] | undefined): Set<string> {
  const hidden = new Set<string>();
  if (!perms) return hidden;
  if (!perms.includes(CPERM.profileRead)) hidden.add("profile");
  if (!perms.includes(CPERM.membersRead)) hidden.add("people");
  if (!perms.includes(COMPANY_AUTH_PERM.read)) hidden.add("agents");
  return hidden;
}

export function hiddenWorkspaceTabs(perms: readonly string[] | undefined): Set<string> {
  const hidden = new Set<string>();
  if (!perms) return hidden;
  if (
    !hasAny(perms, [
      WS_AUTH_PERM.clientsRead,
      WS_AUTH_PERM.read,
      WS_AUTH_PERM.request,
      WS_AUTH_PERM.resolve,
    ])
  ) {
    hidden.add("clients");
  }
  if (!perms.includes(PERM.membersRead)) hidden.add("team");
  if (!perms.includes(PERM.profileRead)) hidden.add("workspace");
  return hidden;
}
