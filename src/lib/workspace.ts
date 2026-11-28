import type { RoleSummary } from "./types";

/**
 * Agent workspace types and pure rules (spec 0012 part B; specs 0001, 0009).
 * Owned by the app. The UI hides what the caller lacks; the API decides.
 */

export interface WorkspacePermissionItem {
  key: string;
  label: string;
  category: string;
  description: string;
  owner_only: boolean;
  baseline: boolean;
  held_by_caller: boolean;
}

export interface WorkspaceRole {
  id: string;
  key?: string;
  name: string;
  description?: string;
  builtin: boolean;
  permissions: string[];
  member_count?: number;
  pending_invitation_count?: number;
}

export interface Workspace {
  id: string;
  type: "personal" | "agency" | string;
  display_name: string;
  legal_profile_type: string;
  verification_status: string;
  verified_at?: string | null;
  contact: { email: string | null; phone: string | null };
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  };
  registration: { authority: string; entity_type: string; identifier: string } | null;
}

export interface WorkspaceContext {
  workspace_id: string;
  membership_id: string;
  role: RoleSummary;
  permissions: string[];
}

export type MemberStatus = "active" | "suspended" | "removed" | string;

export interface Member {
  id: string;
  user: { id: string; full_name: string; email?: string | null; phone?: string | null };
  role: RoleSummary;
  status: MemberStatus;
  joined_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: RoleSummary;
  status: string;
  invited_by: { id?: string; full_name: string };
  expires_at: string;
  created_at: string;
}

/** GET /v1/me/invitations item. */
export interface MyInvitation {
  id: string;
  workspace: { id: string; display_name: string; type: string };
  role: { id: string; name: string };
  invited_by: { full_name: string };
  expires_at: string;
}

/** POST /v1/invitations/lookup (public). `kind` tells workspace from company invitations. */
export interface InvitationLookup {
  kind: "workspace" | "company" | string;
  id: string;
  status: string;
  workspace?: { display_name: string; type: string };
  company?: { legal_name: string };
  role: { name: string };
  invited_by: { full_name: string };
  email_hint: string;
  expires_at: string;
}

/** Workspace permission keys: the UI hides actions with these, never with role names. */
export const PERM = {
  profileRead: "workspace.profile.read",
  profileUpdate: "workspace.profile.update",
  membersRead: "workspace.members.read",
  membersReadContact: "workspace.members.read_contact",
  membersInvite: "workspace.members.invite",
  membersManage: "workspace.members.manage",
  ownersManage: "workspace.owners.manage",
  rolesManage: "workspace.roles.manage",
} as const;

export const MAX_CUSTOM_ROLES = 25;
/** Search and a status filter appear above this many rows (spec 0012 OQ-8). */
export const FILTER_THRESHOLD = 20;

export function can(permissions: readonly string[] | undefined, key: string): boolean {
  return !!permissions?.includes(key);
}

export function isOwnerRole(role: { key?: string; permissions?: readonly string[] }): boolean {
  return role.key === "owner" || !!role.permissions?.includes(PERM.ownersManage);
}

const PURPOSE: Record<string, string> = {
  owner: "Full control of the workspace, including Owners and custom roles.",
  administrator: "Runs day-to-day team and workspace settings. Cannot change Owners.",
  operations_manager: "Manages clients, engagements and who works on them.",
  compliance_officer: "Carries out compliance work for clients.",
  finance: "Sees invoices, payments and commissions.",
  viewer: "Can look but not change anything.",
};

export function describeRole(role: Pick<WorkspaceRole, "key" | "description">): string {
  const d = role.description?.trim();
  if (d) return d;
  return (role.key && PURPOSE[role.key]) || "Access set by your workspace.";
}

/** Roles the actor may grant: no escalation, and Owner roles need owners.manage (R37). */
export function assignableRoles(
  roles: readonly WorkspaceRole[],
  actorPermissions: readonly string[],
): WorkspaceRole[] {
  const actor = new Set(actorPermissions);
  return roles.filter((r) => {
    if (isOwnerRole(r) && !actor.has(PERM.ownersManage)) return false;
    return r.permissions.every((p) => actor.has(p));
  });
}

/** The role with the fewest permissions (the default for an invitation). */
export function leastPrivilegedRole(roles: readonly WorkspaceRole[]): WorkspaceRole | undefined {
  let best: WorkspaceRole | undefined;
  for (const r of roles) if (!best || r.permissions.length <= best.permissions.length) best = r;
  return best;
}

/** Whether the actor may act on a member holding `target` (Owners need owners.manage). */
export function canManageMember(
  target: Pick<RoleSummary, "id" | "key">,
  roles: readonly WorkspaceRole[],
  actorPermissions: readonly string[],
): boolean {
  const actor = new Set(actorPermissions);
  if (!actor.has(PERM.membersManage)) return false;
  const full = roles.find((r) => r.id === target.id);
  const targetIsOwner = full ? isOwnerRole(full) : target.key === "owner";
  return !targetIsOwner || actor.has(PERM.ownersManage);
}

/** Edit or archive a custom role: not built in, not your own, you hold roles.manage and all of its access. */
export function canManageCustomRole(
  role: Pick<WorkspaceRole, "id" | "builtin" | "permissions">,
  actorRoleId: string,
  actorPermissions: readonly string[],
): boolean {
  if (role.builtin || role.id === actorRoleId) return false;
  const actor = new Set(actorPermissions);
  return actor.has(PERM.rolesManage) && role.permissions.every((p) => actor.has(p));
}

export type MemberAction = "change_role" | "suspend" | "reinstate" | "remove" | "leave";

/** The actions to offer on a member card. The API still decides each one. */
export function memberActions(
  m: Pick<Member, "id" | "status" | "role">,
  ctx: Pick<WorkspaceContext, "membership_id" | "permissions">,
  roles: readonly WorkspaceRole[],
  workspaceType: string,
): MemberAction[] {
  const out: MemberAction[] = [];
  if (m.status === "removed") return out;
  const own = m.id === ctx.membership_id;
  if (own) {
    if (workspaceType === "agency" && m.status === "active") out.push("leave");
    return out;
  }
  if (!canManageMember(m.role, roles, ctx.permissions)) return out;
  if (m.status === "active" && assignableRoles(roles, ctx.permissions).length > 0) {
    out.push("change_role");
  }
  if (m.status === "active") out.push("suspend");
  if (m.status === "suspended") out.push("reinstate");
  out.push("remove");
  return out;
}

export type TeamFilter = "all" | "active" | "suspended" | "invited";

export interface TeamRow {
  kind: "member" | "invited";
  id: string;
  title: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  status: "active" | "suspended" | "invited" | "expired" | string;
  member?: Member;
  invitation?: Invitation;
}

export function isExpired(iso: string, now = Date.now()): boolean {
  const t = Date.parse(iso);
  return !Number.isNaN(t) && t < now;
}

export function buildTeamRows(
  members: readonly Member[],
  invitations: readonly Invitation[],
  now = Date.now(),
): TeamRow[] {
  const rows: TeamRow[] = members
    .filter((m) => m.status !== "removed")
    .map((m) => ({
      kind: "member",
      id: m.id,
      title: m.user.full_name,
      email: m.user.email ?? null,
      phone: m.user.phone ?? null,
      role: m.role.name,
      status: m.status,
      member: m,
    }));
  for (const inv of invitations) {
    if (inv.status !== "pending") continue;
    rows.push({
      kind: "invited",
      id: inv.id,
      title: inv.email,
      email: inv.email,
      role: inv.role.name,
      status: isExpired(inv.expires_at, now) ? "expired" : "invited",
      invitation: inv,
    });
  }
  return rows;
}

export function filterTeamRows(rows: readonly TeamRow[], query: string, filter: TeamFilter) {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => {
    if (filter === "active" && r.status !== "active") return false;
    if (filter === "suspended" && r.status !== "suspended") return false;
    if (filter === "invited" && r.kind !== "invited") return false;
    if (!q) return true;
    return [r.title, r.email ?? "", r.role].some((v) => v.toLowerCase().includes(q));
  });
}

/** Search and filter controls are shown only for longer lists. */
export function showListControls(count: number): boolean {
  return count > FILTER_THRESHOLD;
}

export function memberStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Active";
    case "suspended":
      return "Suspended";
    case "invited":
      return "Invited";
    case "expired":
      return "Invitation expired";
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "declined":
      return "Declined";
    case "cancelled":
      return "Cancelled";
    case "superseded":
      return "Replaced";
    default:
      return status;
  }
}

export function workspaceTypeLabel(type: string): string {
  return type === "agency" ? "Agency workspace" : type === "personal" ? "Personal workspace" : type;
}

export const LEGAL_PROFILE_OPTIONS = [
  { value: "individual", label: "Individual" },
  { value: "registered_business", label: "Registered with CAC" },
  { value: "other_organization", label: "Other organisation" },
] as const;

export const ENTITY_TYPES = [
  { value: "company", label: "Company", prefix: "RC" },
  { value: "business_name", label: "Business name", prefix: "BN" },
  { value: "incorporated_trustees", label: "Incorporated trustees", prefix: "IT" },
] as const;

export function legalProfileLabel(value: string): string {
  return LEGAL_PROFILE_OPTIONS.find((o) => o.value === value)?.label ?? value.replaceAll("_", " ");
}

export function entityTypeLabel(value: string): string {
  return ENTITY_TYPES.find((o) => o.value === value)?.label ?? value.replaceAll("_", " ");
}

export interface VerificationMeta {
  label: string;
  tone: "success" | "warning" | "neutral";
}

/** Plain status label; never says "approved by the government" (rule 8). */
export function verificationMeta(status: string): VerificationMeta {
  if (status === "verified") return { label: "Verified", tone: "success" };
  if (status === "pending") return { label: "Under review", tone: "warning" };
  return { label: "Not verified yet", tone: "neutral" };
}

/** Identity fields are locked once verification is pending or verified (API: workspace-verification-locked). */
export function identityLocked(status: string): boolean {
  return status === "pending" || status === "verified";
}

export function normaliseRegistration(identifier: string): string {
  return identifier.toUpperCase().replace(/\s+/g, "");
}

export interface CreateWorkspaceInput {
  type: "personal" | "agency";
  displayName: string;
  legal: string;
  entityType: string;
  identifier: string;
}

export function validateCreateWorkspace(i: CreateWorkspaceInput): Record<string, string> {
  const e: Record<string, string> = {};
  if (!i.displayName.trim()) e.display_name = "Enter a name for the workspace.";
  return e;
}

export function createWorkspaceBody(i: CreateWorkspaceInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: i.type,
    display_name: i.displayName.trim(),
    legal_profile_type: i.legal,
  };
  const id = normaliseRegistration(i.identifier);
  if (i.legal === "registered_business" && id) {
    body.registration = {
      authority: "CAC",
      entity_type: i.entityType || "company",
      identifier: id,
    };
  }
  return body;
}

export interface ProfileDraft {
  displayName: string;
  legal: string;
  entityType: string;
  identifier: string;
  contactEmail: string;
  contactPhone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
}

export function draftFromWorkspace(w: Workspace): ProfileDraft {
  return {
    displayName: w.display_name,
    legal: w.legal_profile_type,
    entityType: w.registration?.entity_type ?? "company",
    identifier: w.registration?.identifier ?? "",
    contactEmail: w.contact.email ?? "",
    contactPhone: w.contact.phone ?? "",
    line1: w.address.line1 ?? "",
    line2: w.address.line2 ?? "",
    city: w.address.city ?? "",
    state: w.address.state ?? "",
  };
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);

/**
 * PATCH body. Identity fields (name, legal form, registration) are sent only
 * when they changed, because the API locks them during verification.
 * `phone` must already be normalised by the caller.
 */
export function profilePatch(current: Workspace, d: ProfileDraft, phone: string) {
  const body: Record<string, unknown> = {
    contact:
      d.contactEmail.trim() || phone
        ? { email: orNull(d.contactEmail), phone: phone || null }
        : null,
    address:
      d.line1.trim() || d.line2.trim() || d.city.trim() || d.state.trim()
        ? {
            line1: orNull(d.line1),
            line2: orNull(d.line2),
            city: orNull(d.city),
            state: orNull(d.state),
            country: "NG",
          }
        : null,
  };
  if (d.displayName.trim() && d.displayName.trim() !== current.display_name) {
    body.display_name = d.displayName.trim();
  }
  if (d.legal && d.legal !== current.legal_profile_type) body.legal_profile_type = d.legal;
  const id = normaliseRegistration(d.identifier);
  const next =
    d.legal === "registered_business" && id
      ? { authority: "CAC", entity_type: d.entityType, identifier: id }
      : null;
  const cur = current.registration
    ? {
        authority: current.registration.authority,
        entity_type: current.registration.entity_type,
        identifier: current.registration.identifier,
      }
    : null;
  if (JSON.stringify(cur) !== JSON.stringify(next)) body.registration = next;
  return body;
}

/* ---------- Roles (spec 0009) ---------- */

export interface PickerItem extends WorkspacePermissionItem {
  selected: boolean;
  /** Baseline permissions are always on and cannot be switched off. */
  locked: boolean;
  disabled: boolean;
  reason?: string;
}

export interface PickerGroup {
  category: string;
  items: PickerItem[];
}

/** Permission picker model from the live catalogue (R15). Order follows the catalogue. */
export function buildPicker(
  catalogue: readonly WorkspacePermissionItem[],
  selected: readonly string[],
): PickerGroup[] {
  const sel = new Set(selected);
  const groups: PickerGroup[] = [];
  for (const p of catalogue) {
    const locked = p.baseline;
    let reason: string | undefined;
    if (locked) reason = "Always included.";
    else if (p.owner_only) reason = "Only the built-in Owner role can have this.";
    else if (!p.held_by_caller) reason = "You can only give access you have yourself.";
    const item: PickerItem = {
      ...p,
      selected: locked || sel.has(p.key),
      locked,
      disabled: locked || !!reason,
      reason,
    };
    let g = groups.find((x) => x.category === p.category);
    if (!g) groups.push((g = { category: p.category, items: [] }));
    g.items.push(item);
  }
  return groups;
}

export function togglePermission(
  selected: readonly string[],
  item: Pick<PickerItem, "key" | "disabled">,
): string[] {
  if (item.disabled) return [...selected];
  return selected.includes(item.key)
    ? selected.filter((k) => k !== item.key)
    : [...selected, item.key];
}

/** The permissions to send: the selection plus every baseline permission, deduplicated. */
export function permissionsToSend(
  catalogue: readonly WorkspacePermissionItem[],
  selected: readonly string[],
): string[] {
  const out = new Set(selected);
  for (const p of catalogue) if (p.baseline) out.add(p.key);
  return [...out];
}

export function roleInUse(r: Pick<WorkspaceRole, "member_count" | "pending_invitation_count">) {
  return (r.member_count ?? 0) + (r.pending_invitation_count ?? 0) > 0;
}

export function customRoleCount(roles: readonly WorkspaceRole[]): number {
  return roles.filter((r) => !r.builtin).length;
}

export function permissionSummary(role: Pick<WorkspaceRole, "permissions">): string {
  const n = role.permissions.length;
  return `${n} ${n === 1 ? "permission" : "permissions"}`;
}

export function roleNameError(name: string): string | null {
  const n = name.trim();
  if (!n) return "Enter a name for the role.";
  if (n.length > 60) return "Use 60 characters or fewer.";
  return null;
}

/** Roles section is for agency workspaces only, for holders of members.read or roles.manage (R6, R21). */
export function showRoles(workspaceType: string, permissions: readonly string[]): boolean {
  return (
    workspaceType === "agency" &&
    (permissions.includes(PERM.membersRead) || permissions.includes(PERM.rolesManage))
  );
}

/** Splits a typed list of invitation emails (comma, semicolon, space or newline). */
export function splitEmails(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[\s,;]+/)) {
    const e = raw.trim().toLowerCase();
    if (e && !seen.has(e)) {
      seen.add(e);
      out.push(e);
    }
  }
  return out;
}

export function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
