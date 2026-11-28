import type { RoleSummary } from "./types";
import type { Answers, Question, QuestionnaireDefinition } from "./questionnaire";
import { isAnswered, pruneAnswers } from "./questionnaire";
import { isExpired } from "./workspace";

/**
 * Company types and pure rules (spec 0012 part C; specs 0002, 0003 user side).
 * Owned by the app. The UI hides what the caller lacks; the API decides.
 */

// ---------------------------------------------------------------- shapes

export interface CompanyPublicIdentifier {
  registration_authority: string;
  entity_type: string;
  identifier_display: string;
  verification_status: string;
}

export interface CompanySummary {
  id: string;
  legal_name: string;
  entity_type: string;
  jurisdiction: string;
  identity_status: string;
  verification_status: string;
  primary_identifier?: CompanyPublicIdentifier | null;
}

export type ResolveOutcome =
  "matched_verified" | "matched_unverified" | "possible_duplicate" | "created_provisional";

export interface ResolveResult {
  outcome: ResolveOutcome | string;
  company?: CompanySummary;
  candidates?: CompanySummary[];
}

export interface ResolveInput {
  legalName: string;
  entityType: string;
  jurisdiction: string;
  authority: string;
  identifier: string;
  confirmDistinct?: boolean;
}

export interface EvidenceType {
  key: string;
  label: string;
  description: string;
  requires_file: boolean;
}

export interface ClaimEvidence {
  id: string;
  type: { key: string; label: string };
  description: string;
  reference: string | null;
  file: { filename: string | null; content_type: string; size_bytes: number } | null;
  added_at: string;
}

export interface Claim {
  id: string;
  status: ClaimStatus | string;
  closed_reason: string | null;
  company: CompanySummary;
  capacity: string;
  capacity_other: string | null;
  message: string | null;
  message_from_reviewer: string | null;
  response_due_at: string | null;
  approved_role: RoleSummary | null;
  submitted_at: string;
  updated_at: string;
  decided_at: string | null;
  can_add_evidence: boolean;
  can_withdraw: boolean;
  evidence: ClaimEvidence[];
}

export interface MyCompanyInvitation {
  id: string;
  company: { id: string; legal_name: string };
  role: { id: string; key?: string; name: string };
  invited_by: { full_name: string };
  expires_at: string;
}

export interface CompanyContextInfo {
  company_id: string;
  company_workspace_id: string;
  membership_id: string;
  role: RoleSummary;
  permissions: string[];
}

export interface DeclaredProfile {
  version: number;
  registered_address: string | null;
  incorporation_date: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  source: string;
  saved_by: { id: string; full_name: string } | null;
  saved_at: string;
}

export interface CompanyHome {
  company: CompanySummary & { identifiers: CompanyPublicIdentifier[] };
  profile: DeclaredProfile;
  activity_profile: { status: string; current_version: number | null };
  owner_state: string;
  open_claim_notices: number | null;
}

export interface CompanyRole {
  id: string;
  key?: string;
  name: string;
  description?: string;
  permissions: string[];
}

export interface ClaimNotice {
  claim_id: string;
  claimant: { full_name: string };
  capacity: string;
  capacity_other: string | null;
  submitted_at: string;
  my_response: { stance: string; note: string | null; created_at: string } | null;
}

export interface ActivityDraft {
  revision: number;
  questionnaire_version_id: string;
  answers: Answers;
  saved_at: string;
  visible_question_keys?: string[];
  missing_required?: string[];
}

export interface ActivityVersion {
  version: number;
  questionnaire_version_id?: string;
  answers: Answers;
  completed_by: { id: string; full_name: string } | null;
  completed_at: string;
  source: string;
  acting_workspace?: { id: string; display_name: string };
}

export interface ActivityView {
  status: string;
  questionnaire: { id: string; version: number; definition: QuestionnaireDefinition };
  newer_questionnaire_available: boolean;
  draft: ActivityDraft | null;
  current: ActivityVersion | null;
}

export interface ActivityVersionItem {
  version: number;
  questionnaire_version: number;
  completed_by: { id: string; full_name: string } | null;
  completed_at: string;
  source: string;
}

export interface ActivityVersionDetail extends ActivityVersion {
  questionnaire: { id: string; version: number; definition: QuestionnaireDefinition };
}

// ------------------------------------------------------------ permissions

export const CPERM = {
  profileRead: "company.profile.read",
  profileUpdate: "company.profile.update",
  activityUpdate: "company.activity_profile.update",
  membersRead: "company.members.read",
  membersReadContact: "company.members.read_contact",
  membersInvite: "company.members.invite",
  membersManage: "company.members.manage",
  ownersManage: "company.owners.manage",
} as const;

export function isCompanyOwnerRole(role: { key?: string; permissions?: readonly string[] }) {
  return role.key === "owner" || !!role.permissions?.includes(CPERM.ownersManage);
}

/** Roles the actor may give: Owner needs owners.manage, and no escalation (0003 R21). */
export function assignableCompanyRoles(
  roles: readonly CompanyRole[],
  actorPermissions: readonly string[],
): CompanyRole[] {
  const actor = new Set(actorPermissions);
  return roles.filter((r) => {
    if (isCompanyOwnerRole(r) && !actor.has(CPERM.ownersManage)) return false;
    return r.permissions.every((p) => actor.has(p));
  });
}

export function canManageCompanyMember(
  target: Pick<RoleSummary, "id" | "key">,
  roles: readonly CompanyRole[],
  actorPermissions: readonly string[],
): boolean {
  const actor = new Set(actorPermissions);
  if (!actor.has(CPERM.membersManage)) return false;
  const full = roles.find((r) => r.id === target.id);
  const targetIsOwner = full ? isCompanyOwnerRole(full) : target.key === "owner";
  return !targetIsOwner || actor.has(CPERM.ownersManage);
}

export type CompanyMemberAction = "change_role" | "suspend" | "reinstate" | "remove" | "leave";

/** Actions to offer on a member card. The API still decides each one (last-Owner rules included). */
export function companyMemberActions(
  m: { id: string; status: string; role: RoleSummary },
  ctx: Pick<CompanyContextInfo, "membership_id" | "permissions">,
  roles: readonly CompanyRole[],
): CompanyMemberAction[] {
  if (m.status === "removed") return [];
  if (m.id === ctx.membership_id) return m.status === "active" ? ["leave"] : [];
  if (!canManageCompanyMember(m.role, roles, ctx.permissions)) return [];
  const out: CompanyMemberAction[] = [];
  if (m.status === "active" && assignableCompanyRoles(roles, ctx.permissions).length > 0) {
    out.push("change_role");
  }
  if (m.status === "active") out.push("suspend");
  if (m.status === "suspended") out.push("reinstate");
  out.push("remove");
  return out;
}

// ------------------------------------------------------------- resolving

export const ENTITY_TYPES = [
  { value: "company", label: "Company", prefix: "RC" },
  { value: "business_name", label: "Business Name", prefix: "BN" },
  { value: "incorporated_trustee", label: "Incorporated Trustee", prefix: "IT" },
  { value: "limited_partnership", label: "Limited Partnership", prefix: "LP" },
  { value: "limited_liability_partnership", label: "Limited Liability Partnership", prefix: "LLP" },
  { value: "other", label: "Other organisation", prefix: "" },
] as const;

export function companyEntityLabel(value: string): string {
  return ENTITY_TYPES.find((e) => e.value === value)?.label ?? value;
}

const KNOWN_PREFIXES = ["LLP", "RC", "BN", "IT", "LP"] as const;

export type IdentifierPreview = { ok: true; display: string } | { ok: false; reason: string };

/**
 * Live preview of how the API will normalise a registration number. The API
 * decides; this only shows the user what to expect ("rc 123-456" -> "RC 123456").
 */
export function previewIdentifier(
  entityType: string,
  authority: string,
  raw: string,
): IdentifierPreview | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const stripped = trimmed.replace(/[\s\-/.#]+/g, "").toUpperCase();
  if (!/^[A-Z0-9]+$/.test(stripped)) return { ok: false, reason: "chars" };
  const auth = (authority.trim() || (entityType !== "other" ? "CAC" : "")).toUpperCase();
  if (auth === "CAC") {
    const want = ENTITY_TYPES.find((e) => e.value === entityType)?.prefix;
    if (!want) return { ok: false, reason: "type" };
    let candidate = stripped;
    if (candidate.startsWith("CAC")) {
      const after = candidate.slice(3);
      if (KNOWN_PREFIXES.some((p) => after.startsWith(p))) candidate = after;
    }
    let found = "";
    let rest = candidate;
    for (const p of KNOWN_PREFIXES) {
      if (candidate.startsWith(p)) {
        found = p;
        rest = candidate.slice(p.length);
        break;
      }
    }
    if (found && found !== want) return { ok: false, reason: `prefix:${want}` };
    if (found && rest.startsWith("NO")) rest = rest.slice(2);
    if (!rest || rest.length > 20 || !/^\d+$/.test(rest))
      return { ok: false, reason: `digits:${want}` };
    return { ok: true, display: `${want} ${rest}` };
  }
  if (stripped.length < 2 || stripped.length > 64) return { ok: false, reason: "length" };
  return { ok: true, display: trimmed.replace(/\s+/g, " ").toUpperCase() };
}

export function validateResolve(i: ResolveInput): Record<string, string> {
  const e: Record<string, string> = {};
  if (!i.legalName.trim()) e.legal_name = "Enter the company's legal name.";
  if (!i.identifier.trim()) e.identifier = "Enter the registration number.";
  else if (previewIdentifier(i.entityType, i.authority, i.identifier)?.ok === false) {
    e.identifier = "Check the registration number.";
  }
  return e;
}

export function resolveBody(i: ResolveInput): Record<string, unknown> {
  const jurisdiction = i.jurisdiction.trim().toUpperCase() || "NG";
  const authority = i.authority.trim().toUpperCase() || (i.entityType === "other" ? "" : "CAC");
  return {
    legal_name: i.legalName.trim(),
    entity_type: i.entityType,
    jurisdiction,
    registration_authority: authority,
    identifier: i.identifier.trim(),
    ...(i.confirmDistinct ? { confirm_distinct: true } : {}),
  };
}

// ---------------------------------------------------------------- claims

export type ClaimStatus =
  "submitted" | "under_review" | "needs_information" | "approved" | "rejected" | "withdrawn";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_EVIDENCE_ITEMS = 10;
export const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;

export const CAPACITIES = [
  { value: "director", label: "Director" },
  { value: "authorized_representative", label: "Authorized representative" },
  { value: "other", label: "Another capacity" },
] as const;

export function capacityLabel(capacity: string, other?: string | null): string {
  if (capacity === "director") return "Director";
  if (capacity === "authorized_representative") return "Authorized representative";
  return other?.trim() ? `Other: ${other.trim()}` : "Other";
}

export type Tone = "success" | "warning" | "neutral" | "danger";

const STATUS: Record<ClaimStatus, { label: string; tone: Tone }> = {
  submitted: { label: "Submitted", tone: "neutral" },
  under_review: { label: "Under review", tone: "neutral" },
  needs_information: { label: "More information needed", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Not approved", tone: "danger" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export function claimStatusMeta(status: string): { label: string; tone: Tone } {
  return STATUS[status as ClaimStatus] ?? { label: status.replaceAll("_", " "), tone: "neutral" };
}

export function isOpenClaim(status: string): boolean {
  return status === "submitted" || status === "under_review" || status === "needs_information";
}

export interface TimelineStep {
  key: "submitted" | "review" | "decision";
  label: string;
  state: "done" | "current" | "todo" | "attention";
}

/** Submitted, review, decision. Contested state is never shown to the claimant. */
export function claimTimeline(status: string): TimelineStep[] {
  const submitted: TimelineStep = { key: "submitted", label: "Submitted", state: "done" };
  const review: TimelineStep = { key: "review", label: "Review", state: "todo" };
  const decision: TimelineStep = { key: "decision", label: "Decision", state: "todo" };
  switch (status) {
    case "submitted":
    case "under_review":
      review.state = "current";
      break;
    case "needs_information":
      review.state = "attention";
      break;
    case "approved":
      review.state = "done";
      decision.state = "done";
      decision.label = "Approved";
      break;
    case "rejected":
      review.state = "done";
      decision.state = "done";
      decision.label = "Not approved";
      break;
    case "withdrawn":
      decision.state = "done";
      decision.label = "Withdrawn";
      break;
  }
  return [submitted, review, decision];
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Quick check before uploading. The API sniffs the real type and decides. */
export function checkUpload(file: { name: string; size: number; type: string }): string | null {
  if (file.size === 0) return "empty";
  if (file.size > MAX_UPLOAD_BYTES) return "large";
  const okType =
    (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type) ||
    /\.(pdf|png|jpe?g)$/i.test(file.name);
  return okType ? null : "type";
}

/** Camera pages are resized and recompressed to fit well inside the API limit (OQ-5). */
export const CAMERA_MAX_EDGE = 2000;
const QUALITY_STEPS = [0.7, 0.5, 0.35] as const;

export function compressionQuality(attempt: number): number | null {
  return QUALITY_STEPS[attempt] ?? null;
}

/** Target width so the long edge is at most CAMERA_MAX_EDGE; undefined when already small. */
export function resizeWidth(width: number, height: number): number | undefined {
  const long = Math.max(width, height);
  if (long <= CAMERA_MAX_EDGE) return undefined;
  return Math.round((width * CAMERA_MAX_EDGE) / long);
}

/** A captured or picked page held on the device until the claim is submitted. */
export interface EvidencePage {
  id: string;
  uri: string;
  name: string;
  mime: string;
  size: number;
}

export interface ClaimDraft {
  capacity: string;
  capacityOther: string;
  message: string;
  typeKey: string;
  reference: string;
  pages: EvidencePage[];
  /** Idempotency-Key of the submission in flight; dropped whenever the content changes. */
  submitKey: string;
  /** Page id to upload id, so a retry never uploads a page twice (uploads last 24 hours). */
  uploads: Record<string, string>;
}

export const EMPTY_CLAIM_DRAFT: ClaimDraft = {
  capacity: "director",
  capacityOther: "",
  message: "",
  typeKey: "",
  reference: "",
  pages: [],
  submitKey: "",
  uploads: {},
};

export function parseClaimDraft(raw: string | undefined): ClaimDraft {
  if (!raw) return EMPTY_CLAIM_DRAFT;
  try {
    const v = JSON.parse(raw) as Partial<ClaimDraft>;
    const str = (x: unknown) => (typeof x === "string" ? x : "");
    return {
      capacity: str(v.capacity) || "director",
      capacityOther: str(v.capacityOther),
      message: str(v.message),
      typeKey: str(v.typeKey),
      reference: str(v.reference),
      submitKey: str(v.submitKey),
      uploads:
        v.uploads && typeof v.uploads === "object" && !Array.isArray(v.uploads)
          ? Object.fromEntries(Object.entries(v.uploads).filter(([, id]) => typeof id === "string"))
          : {},
      pages: Array.isArray(v.pages)
        ? v.pages.filter(
            (p): p is EvidencePage =>
              !!p &&
              typeof p.id === "string" &&
              typeof p.uri === "string" &&
              typeof p.size === "number",
          )
        : [],
    };
  } catch {
    return EMPTY_CLAIM_DRAFT;
  }
}

export interface EvidenceItemBody {
  type_key: string;
  description: string;
  upload_id?: string;
  reference?: string;
}

/** One evidence item per page, then a typed reference if there is one. */
export function evidenceBodies(
  typeKey: string,
  typeLabel: string,
  uploads: readonly string[],
  reference: string,
): EvidenceItemBody[] {
  const out: EvidenceItemBody[] = uploads.map((id, i) => ({
    type_key: typeKey,
    description:
      uploads.length > 1 ? `${typeLabel}, page ${i + 1} of ${uploads.length}` : typeLabel,
    upload_id: id,
  }));
  const ref = reference.trim();
  if (ref) out.push({ type_key: typeKey, description: typeLabel, reference: ref });
  return out;
}

export function claimDraftProblems(
  d: ClaimDraft,
  type: Pick<EvidenceType, "requires_file"> | undefined,
): string[] {
  const out: string[] = [];
  if (!d.typeKey || !type) out.push("type");
  if (d.capacity === "other" && !d.capacityOther.trim()) out.push("capacity");
  if (d.pages.length === 0 && !d.reference.trim()) out.push("evidence");
  else if (type?.requires_file && d.pages.length === 0) out.push("file");
  if (d.pages.length + (d.reference.trim() ? 1 : 0) > MAX_EVIDENCE_ITEMS) out.push("too_many");
  return out;
}

/** Days left (rounded up) until an ISO time, or null if past or unparsable. */
export function daysUntil(iso: string, now = Date.now()): number | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const diff = t - now;
  return diff <= 0 ? null : Math.ceil(diff / 86_400_000);
}

// --------------------------------------------------------------- invites

export function invitationExpired(iso: string): boolean {
  return isExpired(iso);
}

// --------------------------------------------------------------- profile

export interface CompanyProfileDraft {
  address: string;
  incorporationDate: string;
  email: string;
  phone: string;
  website: string;
}

export function profileDraft(p: DeclaredProfile): CompanyProfileDraft {
  return {
    address: p.registered_address ?? "",
    incorporationDate: p.incorporation_date ?? "",
    email: p.contact_email ?? "",
    phone: p.contact_phone ?? "",
    website: p.website ?? "",
  };
}

const orNull = (s: string) => (s.trim() === "" ? null : s.trim());

/** PUT body: every editable field is sent, with the version being edited (0003 R29). */
export function profileBody(version: number, d: CompanyProfileDraft) {
  return {
    expected_version: version,
    registered_address: orNull(d.address),
    incorporation_date: orNull(d.incorporationDate),
    contact_email: orNull(d.email),
    contact_phone: orNull(d.phone),
    website: orNull(d.website),
  };
}

export function profileChanged(p: DeclaredProfile, d: CompanyProfileDraft): boolean {
  const cur = profileDraft(p);
  return (Object.keys(cur) as (keyof CompanyProfileDraft)[]).some(
    (k) => cur[k].trim() !== d[k].trim(),
  );
}

export function isIsoDateText(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return false;
  const [y, mo, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(y, mo - 1, day));
  return d.getUTCFullYear() === y && d.getUTCMonth() === mo - 1 && d.getUTCDate() === day;
}

// --------------------------------------------------------- questionnaire

/** Answers to start from: unsent device changes win over the server draft, which wins over current. */
export function startingAnswers(view: ActivityView, deviceAnswers: Answers | null): Answers {
  if (deviceAnswers) return deviceAnswers;
  return view.draft?.answers ?? view.current?.answers ?? {};
}

/** Human text for one answer, for read-only screens and the review step. */
export function formatAnswer(q: Question, value: unknown): string {
  if (!isAnswered(value)) return "";
  switch (q.type) {
    case "boolean":
      return value === true ? "Yes" : "No";
    case "single_select":
      return q.options?.find((o) => o.value === value)?.label ?? String(value);
    case "multi_select":
      return (Array.isArray(value) ? value : [])
        .map((v) => q.options?.find((o) => o.value === v)?.label ?? String(v))
        .join(", ");
    case "person_list":
      return (Array.isArray(value) ? value : [])
        .map((row) => {
          const r = row as Record<string, unknown>;
          const name = typeof r.full_name === "string" ? r.full_name : "";
          const cap = typeof r.capacity === "string" ? r.capacity : "";
          const pct = typeof r.ownership_percent === "number" ? `${r.ownership_percent}%` : "";
          return [name, cap, pct].filter(Boolean).join(", ");
        })
        .join("\n");
    default:
      return String(value);
  }
}

/** Parses an integer typed on the phone; null when blank or not a whole number. */
export function parseIntegerText(text: string): number | null {
  const t = text.trim();
  return /^-?\d+$/.test(t) ? Number(t) : null;
}

/** Clamp a step index into the available steps (branches can remove steps while editing). */
export function clampStep(index: number, count: number): number {
  return Math.max(0, Math.min(index, Math.max(0, count - 1)));
}

/** Plain message for a validation code on one answer (the API's codes, the app's wording). */
export function answerErrorText(q: Question, code: string): string {
  switch (code) {
    case "too_long":
      return "This is too long.";
    case "out_of_range":
      return q.type === "person_list"
        ? "A number here is out of range."
        : "This number is out of range.";
    case "too_many_items":
      return "You chose or added too many.";
    case "invalid_option":
      return "Choose from the options shown.";
    case "invalid_type":
      if (q.type === "date") return "Enter the date as year-month-day, like 2019-03-27.";
      if (q.type === "month_day") return "Enter month and day, like 03-27.";
      if (q.type === "integer") return "Enter a whole number.";
      if (q.type === "person_list") return "Fill in each person's required details.";
      return "Check this answer.";
    default:
      return "Check this answer.";
  }
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Whether two answer sets mean the same once hidden and blank answers are dropped. */
export function sameAnswers(def: QuestionnaireDefinition, a: Answers, b: Answers): boolean {
  return stable(pruneAnswers(def, a)) === stable(pruneAnswers(def, b));
}
