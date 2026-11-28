import type { CompanySummary, DeclaredProfile } from "./company";

/**
 * Company authorization types and pure rules (spec 0012 part D; spec 0004).
 * Owned by the app. The UI hides what the caller lacks; the API decides.
 * Nothing here shows a scope key or id: labels are plain language.
 */

// ---------------------------------------------------------------- shapes

export interface UserRef {
  id: string;
  full_name: string;
}

export interface VerifiedCredential {
  id: string;
  label: string;
  issuing_body: string;
}

export interface WorkspaceSummary {
  id: string;
  type: string;
  display_name: string;
  verification_status: string;
  declared_service_categories: string[];
  verified_credentials: VerifiedCredential[];
}

export type AuthorizationStatus =
  "pending" | "active" | "rejected" | "cancelled" | "revoked" | "expired";

export interface AuthorizationItem {
  id: string;
  company: CompanySummary;
  workspace: WorkspaceSummary;
  status: AuthorizationStatus | string;
  initiated_by: string;
  action_scopes: string[];
  service_categories: string[];
  requested_action_scopes: string[];
  requested_service_categories: string[];
  supersedes_authorization_id?: string | null;
  request_note: string | null;
  requested_by: UserRef | null;
  requested_at: string;
  request_expires_at: string | null;
  decided_by: UserRef | null;
  decided_at: string | null;
  decision_note: string | null;
  valid_from: string | null;
  expires_at: string | null;
  ended_at: string | null;
  ended_by: UserRef | null;
  ended_by_actor_type: string | null;
  ended_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientItem {
  company: CompanySummary;
  authorization: AuthorizationItem;
}

export interface CatalogueScope {
  key: string;
  label: string;
  description: string;
  implies: string[];
}

export interface CatalogueCategory {
  key: string;
  label: string;
  description?: string;
}

export interface AuthorizationCatalogue {
  action_scopes: CatalogueScope[];
  service_categories: CatalogueCategory[];
}

/** GET /v1/workspaces/{id}/companies/{companyId}: the client view. */
export interface ClientHome {
  company: {
    id: string;
    legal_name: string;
    entity_type: string;
    jurisdiction: string;
    identity_status: string;
    verification_status: string;
    identifiers: {
      registration_authority: string;
      entity_type: string;
      identifier_display: string;
      verification_status: string;
      is_primary: boolean;
    }[];
  };
  profile: DeclaredProfile;
  activity_profile: { status: string; current_version: number | null };
  authorization: {
    id: string;
    action_scopes: string[];
    service_categories: string[];
    expires_at: string | null;
  };
}

// ----------------------------------------------------------- permissions

export const COMPANY_AUTH_PERM = {
  read: "company.authorizations.read",
  approve: "company.authorizations.approve",
  revoke: "company.authorizations.revoke",
} as const;

export const WS_AUTH_PERM = {
  read: "workspace.authorizations.read",
  request: "workspace.authorizations.request",
  clientsRead: "workspace.clients.read",
  clientsUpdate: "workspace.clients.update",
  resolve: "workspace.companies.resolve",
} as const;

// ----------------------------------------------------- plain-language labels

export interface ScopeMeta {
  key: string;
  label: string;
  short: string;
  description: string;
  implies: readonly string[];
}

/** The app's own copy, used until the catalogue loads and for unknown keys. */
export const ACTION_SCOPES: readonly ScopeMeta[] = [
  {
    key: "company_profile.read",
    label: "View company details and business activities",
    short: "View company details",
    description: "See registration details, contact details and business activities.",
    implies: [],
  },
  {
    key: "company_profile.update",
    label: "Edit company details and business activities",
    short: "Edit company details",
    description: "Update the company's declared contact details and business activities.",
    implies: ["company_profile.read"],
  },
  {
    key: "obligations.read",
    label: "View filings and deadlines",
    short: "View filings",
    description: "See upcoming obligations, schedules and filing history.",
    implies: [],
  },
  {
    key: "obligations.manage",
    label: "Manage filings and deadlines",
    short: "Manage filings",
    description: "Prepare filings, update progress and record evidence of submission.",
    implies: ["obligations.read"],
  },
  {
    key: "documents.read",
    label: "View company documents",
    short: "View documents",
    description: "Open and download documents in the company's vault.",
    implies: [],
  },
  {
    key: "documents.upload",
    label: "Upload company documents",
    short: "Upload documents",
    description: "Add certificates, receipts and supporting records to the vault.",
    implies: [],
  },
  {
    key: "engagements.manage",
    label: "Manage service engagements",
    short: "Manage engagements",
    description: "Set up and coordinate work for this company.",
    implies: [],
  },
];

const SCOPE_MAP = new Map(ACTION_SCOPES.map((s) => [s.key, s]));

const CATEGORY_LABELS: Record<string, string> = {
  cac: "CAC and corporate affairs",
  tax: "Tax",
  scuml: "SCUML",
  cbn: "Central Bank",
  ndpc: "Data protection",
  nafdac: "NAFDAC",
  other: "Other services",
};

function humanKey(key: string): string {
  const text = key.replaceAll("_", " ").replaceAll(".", " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

export function scopeLabel(key: string, catalogue?: readonly CatalogueScope[]): string {
  return catalogue?.find((s) => s.key === key)?.label ?? SCOPE_MAP.get(key)?.label ?? humanKey(key);
}

export function scopeShort(key: string): string {
  return SCOPE_MAP.get(key)?.short ?? humanKey(key);
}

export function categoryLabel(key: string, catalogue?: readonly CatalogueCategory[]): string {
  return catalogue?.find((c) => c.key === key)?.label ?? CATEGORY_LABELS[key] ?? humanKey(key);
}

/** The scopes to offer: the live catalogue, else the app's own list. */
export function scopeOptions(catalogue?: AuthorizationCatalogue | null): CatalogueScope[] {
  if (catalogue?.action_scopes.length) return catalogue.action_scopes;
  return ACTION_SCOPES.map((s) => ({
    key: s.key,
    label: s.label,
    description: s.description,
    implies: [...s.implies],
  }));
}

// -------------------------------------------------------- scope selection

/** Checks an edit scope's implied read scope; unchecking a read scope unchecks what needs it. */
export function toggleScope(
  current: readonly string[],
  key: string,
  on: boolean,
  options: readonly { key: string; implies: readonly string[] }[] = ACTION_SCOPES,
): string[] {
  const set = new Set(current);
  if (on) {
    set.add(key);
    for (const imp of options.find((o) => o.key === key)?.implies ?? []) set.add(imp);
  } else {
    set.delete(key);
    for (const o of options) if (o.implies.includes(key)) set.delete(o.key);
  }
  return options.filter((o) => set.has(o.key)).map((o) => o.key);
}

/** Keeps the order of `options` and drops anything not offered. */
export function inOrder(keys: readonly string[], options: readonly { key: string }[]): string[] {
  const set = new Set(keys);
  return options.filter((o) => set.has(o.key)).map((o) => o.key);
}

// ------------------------------------------------------------------ status

export type AuthTone = "success" | "warning" | "neutral" | "danger";

export function statusMeta(
  status: string,
  endedReason?: string | null,
): { label: string; tone: AuthTone } {
  switch (status) {
    case "pending":
      return { label: "Waiting for approval", tone: "warning" };
    case "active":
      return { label: "Active", tone: "success" };
    case "rejected":
      return { label: "Declined", tone: "danger" };
    case "cancelled":
      if (endedReason === "superseded") return { label: "Replaced", tone: "neutral" };
      if (endedReason === "merged_duplicate")
        return { label: "Combined after a merge", tone: "neutral" };
      return { label: "Cancelled", tone: "neutral" };
    case "revoked":
      if (endedReason === "superseded") return { label: "Updated", tone: "neutral" };
      if (endedReason === "relinquished") return { label: "Ended by the adviser", tone: "neutral" };
      if (endedReason === "staff_revoked")
        return { label: "Ended by Company House support", tone: "danger" };
      if (endedReason === "merged_duplicate")
        return { label: "Combined after a merge", tone: "neutral" };
      return { label: "Removed", tone: "neutral" };
    case "expired":
      if (endedReason === "request_timeout") return { label: "Request expired", tone: "neutral" };
      return { label: "Expired", tone: "neutral" };
    default:
      return { label: humanKey(status), tone: "neutral" };
  }
}

/** One line for lists: what the access lets a workspace do. */
export function summarizeAccess(scopes: readonly string[]): string {
  const set = new Set(scopes);
  const edit = set.has("company_profile.update");
  const filings = set.has("obligations.manage");
  if (edit && filings) return "Can edit details and manage filings";
  if (edit) return "Can view and edit company details";
  if (filings) return "Can manage filings";
  if (set.has("company_profile.read")) return "Can view company details";
  return scopes.length === 0 ? "No permissions" : `${scopes.length} permissions`;
}

// ------------------------------------------------------------------ dates

/** YYYY-MM-DD in the Africa/Lagos calendar (UTC+1, no DST). */
export function lagosDate(now: Date = new Date()): string {
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function isDateText(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export type ExpiryPreset = "none" | "3m" | "6m" | "1y" | "custom";

export const EXPIRY_PRESETS: readonly { value: ExpiryPreset; label: string }[] = [
  { value: "none", label: "Until removed" },
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "1y", label: "1 year" },
  { value: "custom", label: "Pick a date" },
];

/** A YYYY-MM-DD date for a preset, or "" for no end date. */
export function expiryForPreset(preset: ExpiryPreset, custom = "", now: Date = new Date()): string {
  if (preset === "none") return "";
  if (preset === "custom") return custom.trim();
  const base = lagosDate(now);
  const d = new Date(`${base}T00:00:00Z`);
  if (preset === "3m") d.setUTCMonth(d.getUTCMonth() + 3);
  else if (preset === "6m") d.setUTCMonth(d.getUTCMonth() + 6);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Checks an end date the user typed. `latest` is the end date of the request
 * being approved: limits can only shorten it. Returns a message or null.
 */
export function expiryProblem(
  date: string,
  opts: { required?: boolean; latest?: string | null; now?: Date } = {},
): string | null {
  const text = date.trim();
  if (!text) {
    if (opts.latest) return "Choose an end date no later than the one requested.";
    return opts.required ? "Choose an end date." : null;
  }
  if (!isDateText(text)) return "Enter the date as year-month-day, like 2027-03-31.";
  if (text <= lagosDate(opts.now)) return "Choose a date in the future.";
  if (opts.latest && text > opts.latest.slice(0, 10)) {
    return "Choose an end date no later than the one requested.";
  }
  return null;
}

/** "Until 31 Mar 2027" or "Until removed". */
export function accessDuration(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "Until removed";
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return "Until removed";
  const text = new Date(t).toLocaleDateString("en-GB", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `Until ${text}`;
}

// --------------------------------------------------------- request bodies

export function requestBody(i: {
  companyId: string;
  scopes: readonly string[];
  categories: readonly string[];
  expiresOn: string;
  note: string;
}): Record<string, unknown> {
  return {
    company_id: i.companyId,
    action_scopes: [...i.scopes],
    service_categories: [...i.categories],
    expires_at: i.expiresOn.trim() || null,
    request_note: i.note.trim() || null,
  };
}

export function requestProblems(i: {
  scopes: readonly string[];
  categories: readonly string[];
  expiresOn: string;
  now?: Date;
}): Record<string, string> {
  const e: Record<string, string> = {};
  if (i.scopes.length === 0) e.action_scopes = "Choose at least one thing you need to do.";
  if (i.categories.length === 0) e.service_categories = "Choose at least one area you'll cover.";
  const exp = expiryProblem(i.expiresOn, { now: i.now });
  if (exp) e.expires_at = exp;
  return e;
}

/** Approve as asked sends no limits, so the API keeps the request as it is. */
export function approveBody(i: {
  limited: boolean;
  scopes: readonly string[];
  categories: readonly string[];
  expiresOn: string;
  note: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (i.limited) {
    body.action_scopes = [...i.scopes];
    body.service_categories = [...i.categories];
    if (i.expiresOn.trim()) body.expires_at = i.expiresOn.trim();
  }
  if (i.note.trim()) body.decision_note = i.note.trim();
  return body;
}

/** What a limited approval or a narrowing may still choose from. */
export function limitProblems(
  asked: { scopes: readonly string[]; categories: readonly string[]; expiresAt: string | null },
  chosen: { scopes: readonly string[]; categories: readonly string[]; expiresOn: string },
  now?: Date,
): Record<string, string> {
  const e: Record<string, string> = {};
  if (chosen.scopes.length === 0) e.action_scopes = "Choose at least one thing to allow.";
  else if (!chosen.scopes.every((s) => asked.scopes.includes(s))) {
    e.action_scopes = "You can only allow what was asked for.";
  }
  if (chosen.categories.length === 0) e.service_categories = "Choose at least one area to allow.";
  else if (!chosen.categories.every((c) => asked.categories.includes(c))) {
    e.service_categories = "You can only allow the areas that were asked for.";
  }
  if (chosen.expiresOn.trim()) {
    const exp = expiryProblem(chosen.expiresOn, { latest: asked.expiresAt, now });
    if (exp) e.expires_at = exp;
  }
  return e;
}

export function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/** A workspace reference is a UUID, typed or pasted with stray spaces. */
export function parseWorkspaceRef(text: string): string | null {
  const t = text.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(t) ? t : null;
}

// ------------------------------------------------------- company side lists

export interface CompanyBuckets {
  waiting: AuthorizationItem[];
  active: AuthorizationItem[];
  history: AuthorizationItem[];
}

const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) || 0 : 0);

/** Waiting (oldest first, so the longest wait is on top), Active, and History (newest first). */
export function bucketAuthorizations(items: readonly AuthorizationItem[]): CompanyBuckets {
  const waiting = items
    .filter((a) => a.status === "pending")
    .sort((a, b) => time(a.requested_at) - time(b.requested_at));
  const active = items
    .filter((a) => a.status === "active")
    .sort((a, b) => a.workspace.display_name.localeCompare(b.workspace.display_name));
  const history = items
    .filter((a) => a.status !== "pending" && a.status !== "active")
    .sort((a, b) => time(b.ended_at ?? b.updated_at) - time(a.ended_at ?? a.updated_at));
  return { waiting, active, history };
}

/** The date a history row happened, for its subtitle. */
export function historyDate(a: AuthorizationItem): string {
  return a.ended_at ?? a.decided_at ?? a.updated_at;
}

// ---------------------------------------------------------- agent portfolio

export type PortfolioFilter = "all" | "edit" | "view" | "ending";

export const PORTFOLIO_FILTERS: readonly { value: PortfolioFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "edit", label: "Can edit" },
  { value: "view", label: "View only" },
  { value: "ending", label: "Ending soon" },
];

/** Clients whose access ends within this many days count as "ending soon". */
export const ENDING_SOON_DAYS = 30;

export function endsSoon(expiresAt: string | null, now = Date.now()): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return !Number.isNaN(t) && t - now <= ENDING_SOON_DAYS * 86_400_000;
}

export function canEditClient(scopes: readonly string[]): boolean {
  return scopes.includes("company_profile.update");
}

export interface PortfolioSummary {
  total: number;
  canEdit: number;
  endingSoon: number;
  waiting: number;
}

export function portfolioSummary(
  clients: readonly ClientItem[],
  waiting: number,
  now = Date.now(),
): PortfolioSummary {
  return {
    total: clients.length,
    canEdit: clients.filter((c) => canEditClient(c.authorization.action_scopes)).length,
    endingSoon: clients.filter((c) => endsSoon(c.authorization.expires_at, now)).length,
    waiting,
  };
}

export function filterClients(
  clients: readonly ClientItem[],
  query: string,
  filter: PortfolioFilter,
  now = Date.now(),
): ClientItem[] {
  const q = query.trim().toLowerCase();
  return clients
    .filter((c) => {
      if (filter === "edit" && !canEditClient(c.authorization.action_scopes)) return false;
      if (filter === "view" && canEditClient(c.authorization.action_scopes)) return false;
      if (filter === "ending" && !endsSoon(c.authorization.expires_at, now)) return false;
      if (!q) return true;
      const ident = c.company.primary_identifier?.identifier_display ?? "";
      return `${c.company.legal_name} ${ident}`.toLowerCase().includes(q);
    })
    .sort((a, b) => a.company.legal_name.localeCompare(b.company.legal_name));
}

export interface RequestBuckets {
  pending: AuthorizationItem[];
  past: AuthorizationItem[];
}

export function bucketRequests(items: readonly AuthorizationItem[]): RequestBuckets {
  const pending = items
    .filter((a) => a.status === "pending")
    .sort((a, b) => time(b.requested_at) - time(a.requested_at));
  const past = items
    .filter((a) => a.status !== "pending" && a.status !== "active")
    .sort((a, b) => time(historyDate(b)) - time(historyDate(a)));
  return { pending, past };
}

/** True when the API says the client is gone (404): drop it from caches. */
export function removeClient(clients: readonly ClientItem[], companyId: string): ClientItem[] {
  return clients.filter((c) => c.company.id !== companyId);
}
