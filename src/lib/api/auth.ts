import type {
  Account,
  ConsentDocument,
  LoginResponse,
  MfaStatus,
  MfaVerifyResponse,
  SessionItem,
  TotpConfirmResponse,
  TotpSetup,
} from "../types";
import { api } from "./runtime";

/**
 * Account, sign-in, MFA and session endpoints (spec 0012 A and B). Request
 * bodies carry passwords and codes: nothing here logs, caches or retains them.
 */

const anon = { anonymous: true } as const;

export const consentDocuments = () =>
  api
    .request<{ items: ConsentDocument[] }>("/v1/consent-documents/current", anon)
    .then((r) => r.items ?? []);

export interface SignupInput {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
  accepted_consent_document_ids: string[];
}

export const signup = (body: SignupInput) =>
  api.request<{ status: string }>("/v1/auth/signup", { ...anon, method: "POST", body });

export const login = (email: string, password: string) =>
  api.request<LoginResponse>("/v1/auth/login", {
    ...anon,
    method: "POST",
    body: { email, password },
  });

export const requestPasswordReset = (email: string) =>
  api.request<{ status: string }>("/v1/auth/password-reset/request", {
    ...anon,
    method: "POST",
    body: { email },
  });

export const confirmPasswordReset = (token: string, new_password: string) =>
  api.request<void>("/v1/auth/password-reset/confirm", {
    ...anon,
    method: "POST",
    body: { token, new_password },
  });

/** The emailed token is confirmed with the account password (0001 R3); no biometric stands in. */
export const confirmEmailVerification = (token: string, password: string) =>
  api.request<void>("/v1/auth/email-verification/confirm", {
    ...anon,
    method: "POST",
    body: { token, password },
  });

export const confirmEmailChange = (token: string, password: string) =>
  api.request<void>("/v1/auth/email-change/confirm", {
    ...anon,
    method: "POST",
    body: { token, password },
  });

export const resendVerification = () =>
  api.request<{ status: string }>("/v1/auth/email-verification/resend", { method: "POST" });

export const acceptConsents = (document_ids: string[]) =>
  api.request<void>("/v1/me/consents", { method: "POST", body: { document_ids } });

export const updateMe = (body: { full_name?: string; phone?: string | null }) =>
  api.request<Account>("/v1/me", { method: "PATCH", body });

export const changePassword = (current_password: string, new_password: string) =>
  api.request<void>("/v1/me/password", {
    method: "POST",
    body: { current_password, new_password },
  });

export const requestEmailChange = (new_email: string, current_password: string) =>
  api.request<{ status: string }>("/v1/me/email-change", {
    method: "POST",
    body: { new_email, current_password },
  });

export const listSessions = () =>
  api.request<{ items: SessionItem[] }>("/v1/me/sessions").then((r) => r.items ?? []);

export const revokeSession = (id: string) =>
  api.request<void>(`/v1/me/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });

export const revokeOtherSessions = () =>
  api.request<{ revoked: number }>("/v1/me/sessions/revoke-others", { method: "POST" });

export const mfaStatus = () => api.request<MfaStatus>("/v1/me/mfa");

export const verifyMfa = (body: { code?: string; recovery_code?: string }) =>
  api.request<MfaVerifyResponse>("/v1/auth/mfa/verify", { method: "POST", body });

export const startTotpSetup = (current_password: string, label: string) =>
  api.request<TotpSetup>("/v1/me/mfa/totp/setup", {
    method: "POST",
    body: { current_password, label },
  });

export const confirmTotpSetup = (factor_id: string, code: string) =>
  api.request<TotpConfirmResponse>("/v1/me/mfa/totp/confirm", {
    method: "POST",
    body: { factor_id, code },
  });

/** Regenerate takes the password and an authenticator code, never a recovery code (0008 R12). */
export const regenerateRecoveryCodes = (current_password: string, code: string) =>
  api.request<{ recovery_codes: string[] }>("/v1/me/mfa/recovery-codes/regenerate", {
    method: "POST",
    body: { current_password, code },
  });

export const disableMfaFactor = (
  factorId: string,
  body: { current_password: string; code?: string; recovery_code?: string },
) =>
  api.request<void>(`/v1/me/mfa/factors/${encodeURIComponent(factorId)}`, {
    method: "DELETE",
    body,
  });
