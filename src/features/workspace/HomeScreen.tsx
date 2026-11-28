import { useRouter, type Href } from "expo-router";
import { useWorkspaceId } from "./useWorkspaceId";
import { useInvitations, useMembers, useWorkspace, useWsContext } from "@/lib/api/workspaces";
import { PERM, can, verificationMeta, workspaceTypeLabel } from "@/lib/workspace";
import { strings } from "@/strings";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const t = strings.ws.home;

/** Agent Home: who you are in this workspace and what needs attention. */
export function HomeScreen() {
  const id = useWorkspaceId();
  const router = useRouter();
  const workspace = useWorkspace(id);
  const ctx = useWsContext(id);
  const perms = ctx.data?.permissions ?? [];
  const canRead = can(perms, PERM.membersRead);
  const canInvite = can(perms, PERM.membersInvite);
  const members = useMembers(id, ctx.isSuccess && canRead);
  const invitations = useInvitations(id, "pending", ctx.isSuccess && canInvite);
  const w = workspace.data;
  const verification = verificationMeta(w?.verification_status ?? "");
  const active = (members.data ?? []).filter((m) => m.status === "active").length;

  return (
    <Screen edges={["bottom"]}>
      <QueryGate queries={[workspace, ctx]}>
        {w ? (
          <>
            <Text variant="title2" bold accessibilityRole="header">
              {w.display_name}
            </Text>
            <Text tone="text2">
              {workspaceTypeLabel(w.type)} · {t.role(ctx.data?.role.name ?? "")}
            </Text>
            <Badge label={verification.label} tone={verification.tone} />
            <Card>
              {canRead ? (
                <Text>
                  {t.members}: {active}
                </Text>
              ) : null}
              {canInvite ? (
                <Text>
                  {t.pendingInvites}: {(invitations.data ?? []).length}
                </Text>
              ) : null}
              {w.type === "agency" && canInvite ? (
                <Button
                  label={t.invitePeople}
                  variant="secondary"
                  onPress={() => router.push(`/w/${id}/invite` as Href)}
                />
              ) : null}
              {w.type === "agency" ? (
                <Button
                  label={t.openTeam}
                  variant="link"
                  onPress={() => router.push(`/w/${id}/team` as Href)}
                />
              ) : null}
            </Card>
            <Notice>{t.clientsNote}</Notice>
          </>
        ) : null}
      </QueryGate>
    </Screen>
  );
}
