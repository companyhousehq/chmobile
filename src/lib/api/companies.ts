import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import type {
  ActivityVersionDetail,
  ActivityVersionItem,
  ActivityView,
  Claim,
  ClaimNotice,
  CompanyContextInfo,
  CompanyHome,
  CompanyRole,
  DeclaredProfile,
  EvidenceItemBody,
  EvidenceType,
  MyCompanyInvitation,
  ResolveInput,
  ResolveResult,
} from "../company";
import { resolveBody } from "../company";
import type { Answers } from "../questionnaire";
import type { Invitation, Member } from "../workspace";
import { useMe } from "./queries";
import { api } from "./runtime";

/**
 * Company endpoints (spec 0003 design 4). Acting context is in the URL
 * (`/v1/companies/{id}/...`). Query keys are user-namespaced:
 * ['u', userId, 'co', companyId, ...] and ['u', userId, 'claims', ...] (design 9.1).
 */

const co = (id: string) => `/v1/companies/${encodeURIComponent(id)}`;
const enc = encodeURIComponent;

export const companyApi = {
  resolve: (input: ResolveInput, key: string) =>
    api.request<ResolveResult>("/v1/companies/resolve", {
      method: "POST",
      body: resolveBody(input),
      headers: { "Idempotency-Key": key },
    }),
  evidenceTypes: () =>
    api.request<{ items: EvidenceType[] }>("/v1/claim-evidence-types").then((r) => r.items ?? []),
  /** One upload per page; the Idempotency-Key is per upload so a retry never doubles it. */
  upload: (file: { uri: string; name: string; type: string }, key: string) => {
    const form = new FormData();
    form.append("file", file as unknown as Blob);
    return api
      .request<{ upload: { id: string } }>("/v1/me/claim-uploads", {
        method: "POST",
        body: form,
        headers: { "Idempotency-Key": key },
      })
      .then((r) => r.upload);
  },
  submitClaim: (
    body: {
      company_id: string;
      capacity: string;
      capacity_other: string | null;
      message: string | null;
      evidence: EvidenceItemBody[];
    },
    key: string,
  ) =>
    api
      .request<{ claim: Claim }>("/v1/me/company-claims", {
        method: "POST",
        body,
        headers: { "Idempotency-Key": key },
      })
      .then((r) => r.claim),
  addEvidence: (
    claimId: string,
    evidence: EvidenceItemBody[],
    message: string | null,
    key: string,
  ) =>
    api
      .request<{ claim: Claim }>(`/v1/me/company-claims/${enc(claimId)}/evidence`, {
        method: "POST",
        body: { evidence, message },
        headers: { "Idempotency-Key": key },
      })
      .then((r) => r.claim),
  withdraw: (claimId: string) =>
    api
      .request<{ claim: Claim }>(`/v1/me/company-claims/${enc(claimId)}/withdraw`, {
        method: "POST",
      })
      .then((r) => r.claim),
  claim: (claimId: string) =>
    api.request<{ claim: Claim }>(`/v1/me/company-claims/${enc(claimId)}`).then((r) => r.claim),
  claims: () => api.getAll<Claim>("/v1/me/company-claims"),
  invitations: () =>
    api
      .request<{ items: MyCompanyInvitation[] }>("/v1/me/company-invitations")
      .then((r) => r.items ?? []),
  acceptInvitation: (id: string) =>
    api.request<{ membership: { id: string; company_id: string } }>(
      `/v1/me/company-invitations/${enc(id)}/accept`,
      { method: "POST" },
    ),
  declineInvitation: (id: string) =>
    api.request<void>(`/v1/me/company-invitations/${enc(id)}/decline`, { method: "POST" }),

  context: (id: string) => api.request<CompanyContextInfo>(`${co(id)}/context`),
  home: (id: string) => api.request<CompanyHome>(co(id)),
  updateProfile: (id: string, body: Record<string, unknown>) =>
    api
      .request<{ profile: DeclaredProfile }>(`${co(id)}/profile`, { method: "PUT", body })
      .then((r) => r.profile),
  roles: (id: string) =>
    api.request<{ items: CompanyRole[] }>(`${co(id)}/roles`).then((r) => r.items ?? []),
  members: (id: string) => api.getAll<Member>(`${co(id)}/members`),
  invites: (id: string, status = "pending,expired") =>
    api.getAll<Invitation>(`${co(id)}/invitations?status=${status}`),
  invite: (id: string, email: string, roleId: string) =>
    api.request<{ invitation: Invitation }>(`${co(id)}/invitations`, {
      method: "POST",
      body: { email, role_id: roleId },
      headers: { "Idempotency-Key": Crypto.randomUUID() },
    }),
  cancelInvite: (id: string, invitationId: string) =>
    api.request<void>(`${co(id)}/invitations/${enc(invitationId)}/cancel`, { method: "POST" }),
  changeRole: (id: string, membershipId: string, roleId: string) =>
    api.request<{ member: Member }>(`${co(id)}/members/${enc(membershipId)}`, {
      method: "PATCH",
      body: { role_id: roleId },
    }),
  memberAction: (id: string, membershipId: string, action: "suspend" | "reinstate" | "remove") =>
    api.request<{ member: Member }>(`${co(id)}/members/${enc(membershipId)}/${action}`, {
      method: "POST",
      body: {},
    }),
  leave: (id: string) => api.request<void>(`${co(id)}/leave`, { method: "POST" }),
  claimNotices: (id: string) =>
    api.request<{ items: ClaimNotice[] }>(`${co(id)}/claim-notices`).then((r) => r.items ?? []),
  respondToNotice: (id: string, claimId: string, stance: "object" | "support", note: string) =>
    api.request<unknown>(`${co(id)}/claim-notices/${enc(claimId)}/response`, {
      method: "POST",
      body: { stance, note: note.trim() === "" ? null : note.trim() },
    }),

  activity: (id: string) => api.request<ActivityView>(`${co(id)}/activity-profile`),
  saveDraft: (
    id: string,
    body: { questionnaire_version_id: string; expected_revision: number; answers: Answers },
  ) => api.request<ActivityView>(`${co(id)}/activity-profile/draft`, { method: "PUT", body }),
  complete: (id: string, expectedRevision: number) =>
    api.request<ActivityView>(`${co(id)}/activity-profile/complete`, {
      method: "POST",
      body: { expected_revision: expectedRevision },
    }),
  versions: (id: string) =>
    api
      .request<{ items: ActivityVersionItem[] }>(`${co(id)}/activity-profile/versions`)
      .then((r) => r.items ?? []),
  version: (id: string, n: number) =>
    api.request<ActivityVersionDetail>(`${co(id)}/activity-profile/versions/${n}`),
};

function useUserId(): string {
  return useMe().data?.id ?? "";
}

function useCoQuery<T>(companyId: string, part: string, fn: () => Promise<T>, enabled = true) {
  const userId = useUserId();
  return useQuery({
    queryKey: ["u", userId, "co", companyId, part],
    enabled: !!userId && !!companyId && enabled,
    queryFn: fn,
  });
}

export const useCompanyContext = (id: string) =>
  useCoQuery(id, "context", () => companyApi.context(id));
export const useCompanyHome = (id: string) => useCoQuery(id, "home", () => companyApi.home(id));
export const useCompanyRoles = (id: string, enabled = true) =>
  useCoQuery(id, "roles", () => companyApi.roles(id), enabled);
export const useCompanyMembers = (id: string, enabled = true) =>
  useCoQuery(id, "members", () => companyApi.members(id), enabled);
export const useCompanyInvites = (id: string, enabled = true) =>
  useCoQuery(id, "invitations", () => companyApi.invites(id), enabled);
export const useClaimNotices = (id: string, enabled = true) =>
  useCoQuery(id, "claim-notices", () => companyApi.claimNotices(id), enabled);
export const useActivity = (id: string) =>
  useCoQuery(id, "activity", () => companyApi.activity(id));
export const useActivityVersions = (id: string) =>
  useCoQuery(id, "activity-versions", () => companyApi.versions(id));
export const useActivityVersion = (id: string, n: number) =>
  useCoQuery(id, `activity-version:${n}`, () => companyApi.version(id, n));

export function useEvidenceTypes() {
  const userId = useUserId();
  return useQuery({
    queryKey: ["u", userId, "evidence-types"],
    enabled: !!userId,
    queryFn: companyApi.evidenceTypes,
  });
}

export function useMyClaims() {
  const userId = useUserId();
  return useQuery({
    queryKey: ["u", userId, "claims"],
    enabled: !!userId,
    queryFn: companyApi.claims,
  });
}

export function useMyClaim(id: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: ["u", userId, "claims", id],
    enabled: !!userId && !!id,
    queryFn: () => companyApi.claim(id),
  });
}

export function useMyCompanyInvitations() {
  const userId = useUserId();
  return useQuery({
    queryKey: ["u", userId, "company-invitations"],
    enabled: !!userId,
    queryFn: companyApi.invitations,
  });
}

/** Refreshes one company's data and the context lists (after a confirmed write). */
export function useRefreshCompany(companyId: string) {
  const qc = useQueryClient();
  const userId = useUserId();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["u", userId, "co", companyId] }),
      qc.invalidateQueries({ queryKey: ["u", userId, "contexts"] }),
    ]);
}

/** Refreshes my claims, company invitations and the context lists. */
export function useRefreshMyCompanies() {
  const qc = useQueryClient();
  const userId = useUserId();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["u", userId, "claims"] }),
      qc.invalidateQueries({ queryKey: ["u", userId, "company-invitations"] }),
      qc.invalidateQueries({ queryKey: ["u", userId, "contexts"] }),
    ]);
}
