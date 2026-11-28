import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import type {
  Invitation,
  InvitationLookup,
  Member,
  MyInvitation,
  Workspace,
  WorkspaceContext,
  WorkspacePermissionItem,
  WorkspaceRole,
} from "../workspace";
import { api } from "./runtime";
import { useMe } from "./queries";

/**
 * Workspace endpoints. Acting context is in the URL (`/v1/workspaces/{id}/...`).
 * Query keys are user-namespaced: ['u', userId, 'ws', workspaceId, ...] (design 9.1).
 */

const ws = (id: string) => `/v1/workspaces/${encodeURIComponent(id)}`;
const idem = () => ({ "Idempotency-Key": Crypto.randomUUID() });

export const wsApi = {
  get: (id: string) => api.request<Workspace>(ws(id)),
  context: (id: string) => api.request<WorkspaceContext>(`${ws(id)}/context`),
  update: (id: string, body: Record<string, unknown>) =>
    api.request<Workspace>(ws(id), { method: "PATCH", body }),
  create: (body: Record<string, unknown>, key: string) =>
    api.request<Workspace>("/v1/workspaces", {
      method: "POST",
      body,
      headers: { "Idempotency-Key": key },
    }),
  members: (id: string) => api.getAll<Member>(`${ws(id)}/members`),
  invitations: (id: string, status = "pending,expired") =>
    api.getAll<Invitation>(`${ws(id)}/invitations?status=${status}`),
  invite: (id: string, email: string, roleId: string) =>
    api.request<Invitation>(`${ws(id)}/invitations`, {
      method: "POST",
      body: { email, role_id: roleId },
      headers: idem(),
    }),
  cancelInvitation: (id: string, invitationId: string) =>
    api.request<void>(`${ws(id)}/invitations/${encodeURIComponent(invitationId)}/cancel`, {
      method: "POST",
    }),
  changeRole: (id: string, membershipId: string, roleId: string) =>
    api.request<Member>(`${ws(id)}/members/${encodeURIComponent(membershipId)}`, {
      method: "PATCH",
      body: { role_id: roleId },
    }),
  memberAction: (id: string, membershipId: string, action: "suspend" | "reinstate" | "remove") =>
    api.request<Member>(`${ws(id)}/members/${encodeURIComponent(membershipId)}/${action}`, {
      method: "POST",
      body: {},
    }),
  leave: (id: string) => api.request<void>(`${ws(id)}/leave`, { method: "POST" }),
  roles: (id: string) =>
    api.request<{ items: WorkspaceRole[] }>(`${ws(id)}/roles`).then((r) => r.items ?? []),
  permissions: (id: string) =>
    api
      .request<{ items: WorkspacePermissionItem[] }>(`${ws(id)}/permissions`)
      .then((r) => r.items ?? []),
  createRole: (id: string, body: { name: string; description: string; permissions: string[] }) =>
    api.request<WorkspaceRole>(`${ws(id)}/roles`, { method: "POST", body, headers: idem() }),
  updateRole: (
    id: string,
    roleId: string,
    body: { name: string; description: string; permissions: string[] },
  ) =>
    api.request<WorkspaceRole>(`${ws(id)}/roles/${encodeURIComponent(roleId)}`, {
      method: "PATCH",
      body,
    }),
  archiveRole: (id: string, roleId: string) =>
    api.request<void>(`${ws(id)}/roles/${encodeURIComponent(roleId)}`, { method: "DELETE" }),
};

export const meInvitations = {
  list: () =>
    api.request<{ items: MyInvitation[] }>("/v1/me/invitations").then((r) => r.items ?? []),
  accept: (id: string) =>
    api.request<{ membership: { id: string; workspace_id: string } }>(
      `/v1/me/invitations/${encodeURIComponent(id)}/accept`,
      { method: "POST" },
    ),
  decline: (id: string) =>
    api.request<void>(`/v1/me/invitations/${encodeURIComponent(id)}/decline`, { method: "POST" }),
  lookup: (token: string) =>
    api.request<InvitationLookup>("/v1/invitations/lookup", {
      method: "POST",
      body: { token },
      anonymous: true,
    }),
};

function useWsQuery<T>(workspaceId: string, part: string, fn: () => Promise<T>, enabled = true) {
  const me = useMe();
  const userId = me.data?.id;
  return useQuery({
    queryKey: ["u", userId ?? "", "ws", workspaceId, part],
    enabled: !!userId && !!workspaceId && enabled,
    queryFn: fn,
  });
}

export const useWorkspace = (id: string) => useWsQuery(id, "profile", () => wsApi.get(id));
export const useWsContext = (id: string) => useWsQuery(id, "context", () => wsApi.context(id));
export const useMembers = (id: string, enabled = true) =>
  useWsQuery(id, "members", () => wsApi.members(id), enabled);
export const useInvitations = (id: string, status = "pending,expired", enabled = true) =>
  useWsQuery(id, `invitations:${status}`, () => wsApi.invitations(id, status), enabled);
export const useRoles = (id: string, enabled = true) =>
  useWsQuery(id, "roles", () => wsApi.roles(id), enabled);
export const usePermissionCatalogue = (id: string, enabled = true) =>
  useWsQuery(id, "permissions", () => wsApi.permissions(id), enabled);

export function useMyInvitations() {
  const me = useMe();
  const userId = me.data?.id;
  return useQuery({
    queryKey: ["u", userId ?? "", "invitations"],
    enabled: !!userId,
    queryFn: meInvitations.list,
  });
}

/** Refreshes everything for one workspace and the context lists (after a confirmed write). */
export function useRefreshWorkspace(workspaceId: string) {
  const qc = useQueryClient();
  const me = useMe();
  const userId = me.data?.id ?? "";
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["u", userId, "ws", workspaceId] }),
      qc.invalidateQueries({ queryKey: ["u", userId, "contexts"] }),
    ]);
}

export function useRefreshMyWorkspaces() {
  const qc = useQueryClient();
  const me = useMe();
  const userId = me.data?.id ?? "";
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["u", userId, "contexts"] }),
      qc.invalidateQueries({ queryKey: ["u", userId, "invitations"] }),
    ]);
}
