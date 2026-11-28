/**
 * API types owned by the app (spec 0011 R8): the API is the contract, so only
 * the fields the app reads are declared. Written for the app, not imported.
 */

export interface FieldError {
  field: string;
  code: string;
}

/** RFC 9457 problem+json body. */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: FieldError[];
  retry_after_seconds?: number;
  /** Present on `app-update-required` (426). */
  min_version?: string;
  platform?: string;
}

export interface PageResponse<T> {
  items: T[];
  next_cursor?: string | null;
}

export interface RoleSummary {
  id: string;
  key?: string;
  name: string;
}

/** One row of GET /v1/me/companies. */
export interface MyCompanyItem {
  company: { id: string; legal_name: string };
  membership: { id: string; role: RoleSummary; joined_at: string };
}

/** One row of GET /v1/me/workspaces (personal and agency workspaces). */
export interface MyWorkspaceItem {
  workspace: {
    id: string;
    type: "personal" | "agency" | string;
    display_name: string;
    verification_status?: string;
  };
  membership: { id: string; role: RoleSummary; joined_at: string };
}

export interface AcceptedConsent {
  document_id: string;
  kind: string;
  version: number;
  accepted_at: string;
}

/** GET /v1/me. */
export interface Account {
  id: string;
  email: string;
  email_verified: boolean;
  full_name: string;
  phone: string | null;
  created_at: string;
  pending_email_change: { new_email: string; expires_at: string } | null;
  consent?: { accepted: AcceptedConsent[] };
  mfa_enabled: boolean;
  mfa_required: boolean;
}

/** GET /v1/consent-documents/current items. `url` is a path on the website. */
export interface ConsentDocument {
  id: string;
  kind: string;
  version: number;
  url: string;
  published_at: string;
}

/** Requirements the API still wants met before the session is usable. */
export type Requirement = "factor" | "factor_setup" | "consent";

export interface SessionSummary {
  id: string;
  idle_expires_at: string;
  absolute_expires_at: string;
  aal?: number;
}

/** POST /v1/auth/login. The token is the secret: never log or persist it outside the secure store. */
export interface LoginResponse {
  token: string;
  session: SessionSummary;
  requirements: string[];
  email_verified: boolean;
}

/** GET /v1/me/sessions items; client fields are added by design 4.3. */
export interface SessionItem {
  id: string;
  created_at: string;
  last_seen_at: string;
  user_agent: string;
  ip_approx: string;
  absolute_expires_at: string;
  current: boolean;
  client_platform?: "web" | "ios" | "android";
  app_version?: string | null;
}

export interface MfaFactor {
  id: string;
  kind: string;
  label: string;
  created_at: string;
  verified_at: string | null;
  last_used_at: string | null;
}

export interface MfaStatus {
  enabled: boolean;
  required: boolean;
  stage: "active" | "factor_required" | "factor_setup_required" | string;
  factors: MfaFactor[];
  recovery_codes_remaining: number;
}

/** POST /v1/me/mfa/totp/setup. The secret and URI exist only in screen state. */
export interface TotpSetup {
  factor_id: string;
  secret: string;
  otpauth_uri: string;
  issuer: string;
  account_name: string;
}

export interface TotpConfirmResponse {
  factor: MfaFactor;
  recovery_codes: string[];
  session: SessionSummary;
  requirements: string[];
}

export interface MfaVerifyResponse {
  session: SessionSummary;
  requirements: string[];
  recovery_codes_remaining?: number;
}
