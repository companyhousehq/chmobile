import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { ActivityBody, type ActivitySource } from "@/features/company/ActivityScreen";
import { useWorkspaceId } from "@/features/workspace/useWorkspaceId";
import { ApiError } from "@/lib/api/client";
import {
  authApi,
  clientDraftKey,
  useClientActivity,
  useClientHome,
  useDropClient,
} from "@/lib/api/authorizations";
import { useMe } from "@/lib/api/queries";
import { useWsContext } from "@/lib/api/workspaces";
import { WS_AUTH_PERM, canEditClient } from "@/lib/authorizations";
import { can } from "@/lib/workspace";
import { strings } from "@/strings";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Screen } from "@/ui/Screen";

/** A client's business activities: viewed, and edited only when the access and the member's role allow it. */
export function ClientActivityScreen() {
  const id = useWorkspaceId();
  const { companyId } = useLocalSearchParams<{ companyId: string }>();
  const cid = companyId ?? "";
  const qc = useQueryClient();
  const router = useRouter();
  const drop = useDropClient(id);
  const handled = useRef(false);
  const me = useMe();
  const ctx = useWsContext(id);
  const home = useClientHome(id, cid);
  const view = useClientActivity(id, cid);
  // A 404 means the access is gone (AC40): drop the client and its device draft.
  const gone = [home.error, view.error].some((e) => e instanceof ApiError && e.status === 404);
  useEffect(() => {
    if (!gone || handled.current) return;
    handled.current = true;
    void drop(cid);
    Alert.alert(strings.az.client.gone.title, strings.az.client.gone.body);
    router.replace(`/w/${id}/clients` as Href);
  }, [gone, drop, cid, id, router]);
  const scopes = home.data?.authorization.action_scopes ?? [];
  const canEdit = can(ctx.data?.permissions, WS_AUTH_PERM.clientsUpdate) && canEditClient(scopes);
  const userId = me.data?.id ?? "";
  const source: ActivitySource = {
    draftKey: clientDraftKey(id, cid),
    historyHref: `/w/${id}/client/${cid}/activity/versions`,
    saveDraft: (body) => authApi.clientSaveDraft(id, cid, body),
    complete: (rev) => authApi.clientComplete(id, cid, rev),
    refresh: () => qc.invalidateQueries({ queryKey: ["u", userId, "ws", id, "client", cid] }),
  };
  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: strings.az.activity.title }} />
      <QueryGate queries={gone ? [me, ctx] : [me, ctx, home, view]}>
        {view.data && me.data ? (
          <>
            {!canEdit ? <Notice>{strings.az.client.viewOnly}</Notice> : null}
            <ActivityBody source={source} userId={me.data.id} view={view.data} canEdit={canEdit} />
          </>
        ) : null}
      </QueryGate>
    </Screen>
  );
}
