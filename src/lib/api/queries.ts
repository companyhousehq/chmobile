import { useQuery } from "@tanstack/react-query";
import type { Account, MyCompanyItem, MyWorkspaceItem } from "../types";
import type { ContextLists } from "../context/startingContext";
import { api } from "./runtime";
import { listSessions, mfaStatus } from "./auth";

/** Query keys start with the user id, then the context (design 9.1). */
export const keys = {
  me: ["me"] as const,
  sessions: (userId: string) => ["u", userId, "sessions"] as const,
  mfa: (userId: string) => ["u", userId, "mfa"] as const,
  contexts: (userId: string) => ["u", userId, "contexts"] as const,
};

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: () => api.request<Account>("/v1/me"),
  });
}

/** Companies and agent workspaces the user belongs to (R4, R5). */
export function useContextLists(userId: string | undefined) {
  return useQuery({
    queryKey: keys.contexts(userId ?? ""),
    enabled: !!userId,
    meta: { persist: true },
    queryFn: async (): Promise<ContextLists> => {
      const [companies, workspaces] = await Promise.all([
        api.getAll<MyCompanyItem>("/v1/me/companies"),
        api.getAll<MyWorkspaceItem>("/v1/me/workspaces"),
      ]);
      return { companies, workspaces };
    },
  });
}

/** Sessions are never cached to disk: they hold device and IP detail. */
export function useSessions(userId: string | undefined) {
  return useQuery({
    queryKey: keys.sessions(userId ?? ""),
    enabled: !!userId,
    queryFn: listSessions,
  });
}

export function useMfaStatus(userId: string | undefined) {
  return useQuery({
    queryKey: keys.mfa(userId ?? ""),
    enabled: !!userId,
    queryFn: mfaStatus,
  });
}
