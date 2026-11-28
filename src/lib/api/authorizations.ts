import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import type {
  AuthorizationCatalogue,
  AuthorizationItem,
  ClientHome,
  ClientItem,
  WorkspaceSummary,
} from "../authorizations";
import { clearActivityDraft } from "../companyDrafts";
import type {
  ActivityVersionDetail,
  ActivityVersionItem,
  ActivityView,
  DeclaredProfile,
  ResolveInput,
  ResolveResult,
} from "../company";
import { resolveBody } from "../company";
import type { Answers } from "../questionnaire";
import { useMe } from "./queries";
import { api } from "./runtime";

/**
 * Company authorization endpoints (spec 0004). Company side lives under
 * `/v1/companies/{id}/authorizations`, agent side under
 * `/v1/workspaces/{id}/authorizations` and `/companies`. Keys are user-namespaced:
 * ['u', userId, 'co', companyId, 'authz', ...] and ['u', userId, 'ws', workspaceId, 'clients' ...].
 */

const enc = encodeURIComponent;
const co = (id: string) => `/v1/companies/${enc(id)}`;
const ws = (id: string) => `/v1/workspaces/${enc(id)}`;
const one = (r: { authorization: AuthorizationItem }) => r.authorization;

export const authApi = {
  catalogue: () => api.request<AuthorizationCatalogue>("/v1/authorization-catalogue"),

  // Company side
  companyList: (companyId: string) =>
    api.getAll<AuthorizationItem>(`${co(companyId)}/authorizations`),
  companyGet: (companyId: string, id: string) =>
    api
      .request<{ authorization: AuthorizationItem }>(`${co(companyId)}/authorizations/${enc(id)}`)
      .then(one),
  lookupWorkspace: (companyId: string, workspaceId: string) =>
    api
      .request<{ workspace: WorkspaceSummary }>(`${co(companyId)}/workspaces/lookup`, {
        query: { workspace_id: workspaceId },
      })
      .then((r) => r.workspace),
  grant: (companyId: string, body: Record<string, unknown>, key: string) =>
    api
      .request<{ authorization: AuthorizationItem }>(`${co(companyId)}/authorizations`, {
        method: "POST",
        body,
        headers: { "Idempotency-Key": key },
      })
      .then(one),
  approve: (companyId: string, id: string, body: Record<string, unknown>) =>
    api
      .request<{ authorization: AuthorizationItem }>(
        `${co(companyId)}/authorizations/${enc(id)}/approve`,
        { method: "POST", body },
      )
      .then(one),
  reject: (companyId: string, id: string, note: string) =>
    api
      .request<{ authorization: AuthorizationItem }>(
        `${co(companyId)}/authorizations/${enc(id)}/reject`,
        { method: "POST", body: { decision_note: note.trim() || null } },
      )
      .then(one),
  narrow: (companyId: string, id: string, body: Record<string, unknown>) =>
    api
      .request<{ authorization: AuthorizationItem }>(`${co(companyId)}/authorizations/${enc(id)}`, {
        method: "PATCH",
        body,
      })
      .then(one),
  revoke: (companyId: string, id: string, reason: string) =>
    api
      .request<{ authorization: AuthorizationItem }>(
        `${co(companyId)}/authorizations/${enc(id)}/revoke`,
        { method: "POST", body: { reason: reason.trim() || null } },
      )
      .then(one),

  // Agent side
  wsList: (workspaceId: string) =>
    api.getAll<AuthorizationItem>(`${ws(workspaceId)}/authorizations`),
  wsClients: (workspaceId: string) => api.getAll<ClientItem>(`${ws(workspaceId)}/companies`),
  wsResolve: (workspaceId: string, input: ResolveInput, key: string) =>
    api.request<ResolveResult>(`${ws(workspaceId)}/companies/resolve`, {
      method: "POST",
      body: resolveBody(input),
      headers: { "Idempotency-Key": key },
    }),
  request: (workspaceId: string, body: Record<string, unknown>, key: string) =>
    api
      .request<{ authorization: AuthorizationItem }>(`${ws(workspaceId)}/authorizations`, {
        method: "POST",
        body,
        headers: { "Idempotency-Key": key },
      })
      .then(one),
  cancel: (workspaceId: string, id: string) =>
    api
      .request<{ authorization: AuthorizationItem }>(
        `${ws(workspaceId)}/authorizations/${enc(id)}/cancel`,
        { method: "POST", body: {} },
      )
      .then(one),
  relinquish: (workspaceId: string, id: string, reason: string) =>
    api
      .request<{ authorization: AuthorizationItem }>(
        `${ws(workspaceId)}/authorizations/${enc(id)}/relinquish`,
        { method: "POST", body: { reason: reason.trim() || null } },
      )
      .then(one),

  // Client view
  clientHome: (workspaceId: string, companyId: string) =>
    api.request<ClientHome>(`${ws(workspaceId)}/companies/${enc(companyId)}`),
  clientUpdateProfile: (workspaceId: string, companyId: string, body: Record<string, unknown>) =>
    api
      .request<{ profile: DeclaredProfile }>(
        `${ws(workspaceId)}/companies/${enc(companyId)}/profile`,
        { method: "PUT", body },
      )
      .then((r) => r.profile),
  clientActivity: (workspaceId: string, companyId: string) =>
    api.request<ActivityView>(`${ws(workspaceId)}/companies/${enc(companyId)}/activity-profile`),
  clientVersions: (workspaceId: string, companyId: string) =>
    api
      .request<{
        items: ActivityVersionItem[];
      }>(`${ws(workspaceId)}/companies/${enc(companyId)}/activity-profile/versions`)
      .then((r) => r.items ?? []),
  clientVersion: (workspaceId: string, companyId: string, n: number) =>
    api.request<ActivityVersionDetail>(
      `${ws(workspaceId)}/companies/${enc(companyId)}/activity-profile/versions/${n}`,
    ),
  clientSaveDraft: (
    workspaceId: string,
    companyId: string,
    body: { questionnaire_version_id: string; expected_revision: number; answers: Answers },
  ) =>
    api.request<ActivityView>(
      `${ws(workspaceId)}/companies/${enc(companyId)}/activity-profile/draft`,
      { method: "PUT", body },
    ),
  clientComplete: (workspaceId: string, companyId: string, expectedRevision: number) =>
    api.request<ActivityView>(
      `${ws(workspaceId)}/companies/${enc(companyId)}/activity-profile/complete`,
      { method: "POST", body: { expected_revision: expectedRevision } },
    ),
};

export const newAuthKey = () => Crypto.randomUUID();

function useUserId(): string {
  return useMe().data?.id ?? "";
}

export function useCatalogue() {
  const userId = useUserId();
  return useQuery({
    queryKey: ["u", userId, "authz-catalogue"],
    enabled: !!userId,
    queryFn: authApi.catalogue,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCompanyAuthorizations(companyId: string, enabled = true) {
  const userId = useUserId();
  return useQuery({
    queryKey: ["u", userId, "co", companyId, "authz"],
    enabled: !!userId && !!companyId && enabled,
    queryFn: () => authApi.companyList(companyId),
  });
}

export function useWorkspaceClients(workspaceId: string, enabled = true) {
  const userId = useUserId();
  return useQuery({
    queryKey: ["u", userId, "ws", workspaceId, "clients"],
    enabled: !!userId && !!workspaceId && enabled,
    queryFn: () => authApi.wsClients(workspaceId),
  });
}

export function useWorkspaceRequests(workspaceId: string, enabled = true) {
  const userId = useUserId();
  return useQuery({
    queryKey: ["u", userId, "ws", workspaceId, "authz"],
    enabled: !!userId && !!workspaceId && enabled,
    queryFn: () => authApi.wsList(workspaceId),
  });
}

export function useClientHome(workspaceId: string, companyId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: ["u", userId, "ws", workspaceId, "client", companyId, "home"],
    enabled: !!userId && !!workspaceId && !!companyId,
    queryFn: () => authApi.clientHome(workspaceId, companyId),
    retry: false,
  });
}

export function useClientActivity(workspaceId: string, companyId: string, enabled = true) {
  const userId = useUserId();
  return useQuery({
    queryKey: ["u", userId, "ws", workspaceId, "client", companyId, "activity"],
    enabled: !!userId && !!workspaceId && !!companyId && enabled,
    queryFn: () => authApi.clientActivity(workspaceId, companyId),
    retry: false,
  });
}

export function useClientVersions(workspaceId: string, companyId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: ["u", userId, "ws", workspaceId, "client", companyId, "activity-versions"],
    enabled: !!userId && !!workspaceId && !!companyId,
    queryFn: () => authApi.clientVersions(workspaceId, companyId),
    retry: false,
  });
}

export function useClientVersion(workspaceId: string, companyId: string, n: number) {
  const userId = useUserId();
  return useQuery({
    queryKey: ["u", userId, "ws", workspaceId, "client", companyId, `activity-version:${n}`],
    enabled: !!userId && !!workspaceId && !!companyId,
    queryFn: () => authApi.clientVersion(workspaceId, companyId, n),
    retry: false,
  });
}

/** Refreshes one company's authorization lists after a confirmed write. */
export function useRefreshCompanyAuthz(companyId: string) {
  const qc = useQueryClient();
  const userId = useUserId();
  return () => qc.invalidateQueries({ queryKey: ["u", userId, "co", companyId, "authz"] });
}

/** Refreshes the agent's clients and requests after a confirmed write. */
export function useRefreshClients(workspaceId: string) {
  const qc = useQueryClient();
  const userId = useUserId();
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["u", userId, "ws", workspaceId, "clients"] }),
      qc.invalidateQueries({ queryKey: ["u", userId, "ws", workspaceId, "authz"] }),
    ]);
  };
}

/** Key of the device draft of a client's questionnaire (see ClientActivityScreen). */
export const clientDraftKey = (workspaceId: string, companyId: string) =>
  `ws:${workspaceId}:${companyId}`;

/** After the API says access is gone (404): remove the client from lists and cached data. */
export function useDropClient(workspaceId: string) {
  const qc = useQueryClient();
  const userId = useUserId();
  return async (companyId: string) => {
    qc.setQueryData<ClientItem[]>(["u", userId, "ws", workspaceId, "clients"], (old) =>
      old?.filter((c) => c.company.id !== companyId),
    );
    qc.removeQueries({ queryKey: ["u", userId, "ws", workspaceId, "client", companyId] });
    // The device draft of this client's questionnaire goes with the access.
    clearActivityDraft(userId, clientDraftKey(workspaceId, companyId));
    await qc.invalidateQueries({ queryKey: ["u", userId, "ws", workspaceId, "clients"] });
  };
}

/** The same body resends the same Idempotency-Key, so a retry never creates a second record. */
export function keyForBody(keys: Map<string, string>, body: unknown): string {
  const sig = JSON.stringify(body);
  let key = keys.get(sig);
  if (!key) {
    key = newAuthKey();
    keys.set(sig, key);
  }
  return key;
}
