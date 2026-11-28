import { Stack } from "expo-router";
import { useState } from "react";
import { useWorkspaceId } from "./useWorkspaceId";
import { useInvitations, useRefreshWorkspace, useWsContext, wsApi } from "@/lib/api/workspaces";
import { problemMessage } from "@/lib/problems";
import { useAction } from "@/lib/useAction";
import { PERM, can, formatDate, isExpired, memberStatusLabel } from "@/lib/workspace";
import { strings } from "@/strings";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chips } from "@/ui/Chips";
import { confirm } from "@/ui/confirm";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const t = strings.ws.invitations;
const tt = strings.ws.team;

type Tab = "pending" | "accepted" | "declined" | "cancelled" | "superseded";

/** Invitations by status; pending ones can be resent or cancelled (0001 R38-R43). */
export function InvitationsScreen() {
  const id = useWorkspaceId();
  const ctx = useWsContext(id);
  const [tab, setTab] = useState<Tab>("pending");
  const list = useInvitations(id, tab === "pending" ? "pending,expired" : tab);
  const refresh = useRefreshWorkspace(id);
  const [notice, setNotice] = useState<string | null>(null);
  const act = useAction(async (fn: () => Promise<unknown>, msg: string) => {
    await fn();
    await refresh();
    setNotice(msg);
  }, "invite");
  const canInvite = can(ctx.data?.permissions, PERM.membersInvite);

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t.title }} />
      <Chips
        label={t.title}
        value={tab}
        onChange={(v) => {
          setNotice(null);
          setTab(v);
        }}
        options={[
          { value: "pending", label: t.pending },
          { value: "accepted", label: t.accepted },
          { value: "declined", label: t.declined },
          { value: "cancelled", label: t.cancelled },
          { value: "superseded", label: t.superseded },
        ]}
      />
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {act.error ? <Notice tone="danger">{act.error}</Notice> : null}
      <QueryGate queries={[ctx, list]}>
        {!canInvite ? (
          <Notice>{problemMessage({ type: "/problems/forbidden", status: 403 })}</Notice>
        ) : null}
        {canInvite && (list.data ?? []).length === 0 ? (
          <Text tone="textMuted">{t.empty}</Text>
        ) : null}
        {canInvite &&
          (list.data ?? []).map((inv) => {
            const expired = inv.status === "pending" && isExpired(inv.expires_at);
            const status = expired ? "expired" : inv.status;
            return (
              <Card key={inv.id}>
                <Text bold>{inv.email}</Text>
                <Text variant="footnote" tone="text2">
                  {inv.role.name} · {t.invitedBy(inv.invited_by.full_name)}
                </Text>
                <Text variant="footnote" tone="textMuted">
                  {expired
                    ? tt.expiredOn(formatDate(inv.expires_at))
                    : tt.expires(formatDate(inv.expires_at))}
                </Text>
                <Badge
                  label={memberStatusLabel(status)}
                  tone={
                    status === "pending" ? "warning" : status === "accepted" ? "success" : "neutral"
                  }
                />
                {inv.status === "pending" ? (
                  <>
                    <Button
                      label={tt.resend}
                      variant="secondary"
                      busy={act.pending}
                      onPress={() => {
                        setNotice(null);
                        void act.run(
                          () => wsApi.invite(id, inv.email, inv.role.id),
                          tt.resent(inv.email),
                        );
                      }}
                    />
                    <Button
                      label={tt.cancelInvite}
                      variant="link"
                      destructive
                      busy={act.pending}
                      onPress={async () => {
                        if (
                          await confirm(
                            tt.cancelInvite,
                            tt.confirmCancel(inv.email),
                            tt.cancelInvite,
                          )
                        ) {
                          setNotice(null);
                          void act.run(
                            () => wsApi.cancelInvitation(id, inv.id),
                            tt.invitationCancelled(inv.email),
                          );
                        }
                      }}
                    />
                  </>
                ) : null}
              </Card>
            );
          })}
      </QueryGate>
    </Screen>
  );
}
