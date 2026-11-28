import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { meInvitations, useMyInvitations, useRefreshMyWorkspaces } from "@/lib/api/workspaces";
import { useAction } from "@/lib/useAction";
import { formatDate, workspaceTypeLabel } from "@/lib/workspace";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { confirm } from "@/ui/confirm";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Text } from "@/ui/Text";

const t = strings.ws.mine;

/** Pending workspace invitations for the signed-in user, listed apart from memberships (0001 R47). */
export function PendingInvitations() {
  const router = useRouter();
  const list = useMyInvitations();
  const refresh = useRefreshMyWorkspaces();
  const [notice, setNotice] = useState<string | null>(null);
  const act = useAction(async (fn: () => Promise<unknown>) => fn(), "invite");

  const respond = async (id: string, kind: "accept" | "decline") => {
    setNotice(null);
    if (kind === "decline" && !(await confirm(t.decline, t.confirmDecline, t.decline))) return;
    const res = await act.exec(() =>
      kind === "accept" ? meInvitations.accept(id) : meInvitations.decline(id),
    );
    if (!res.ok) return;
    await refresh();
    if (kind === "accept") {
      const value = res.value as { membership: { workspace_id: string } };
      setNotice(t.accepted);
      router.replace(`/w/${value.membership.workspace_id}` as Href);
    } else setNotice(t.declined);
  };

  return (
    <QueryGate queries={[list]}>
      {(list.data ?? []).length > 0 ? (
        <>
          <Text variant="footnote" tone="textMuted" bold accessibilityRole="header">
            {t.pending}
          </Text>
          {act.error ? <Notice tone="danger">{act.error}</Notice> : null}
          {(list.data ?? []).map((inv) => (
            <Card key={inv.id}>
              <Text bold>{inv.workspace.display_name}</Text>
              <Text variant="footnote" tone="text2">
                {workspaceTypeLabel(inv.workspace.type)} ·{" "}
                {t.invitedBy(inv.invited_by.full_name, inv.role.name)}
              </Text>
              <Text variant="footnote" tone="textMuted">
                {strings.ws.team.expires(formatDate(inv.expires_at))}
              </Text>
              <Button
                label={`${t.accept}: ${inv.workspace.display_name}`}
                busy={act.pending}
                onPress={() => void respond(inv.id, "accept")}
              />
              <Button
                label={`${t.decline}: ${inv.workspace.display_name}`}
                variant="link"
                busy={act.pending}
                onPress={() => void respond(inv.id, "decline")}
              />
            </Card>
          ))}
        </>
      ) : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}
    </QueryGate>
  );
}
