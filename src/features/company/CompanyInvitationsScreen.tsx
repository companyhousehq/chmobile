import { Stack } from "expo-router";
import { useState } from "react";
import { useCompanyId } from "./useCompanyId";
import {
  companyApi,
  useCompanyContext,
  useCompanyInvites,
  useRefreshCompany,
} from "@/lib/api/companies";
import { CPERM } from "@/lib/company";
import { problemMessage } from "@/lib/problems";
import { useAction } from "@/lib/useAction";
import { can, formatDate, isExpired, memberStatusLabel } from "@/lib/workspace";
import { strings } from "@/strings";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { confirm } from "@/ui/confirm";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const t = strings.ws.invitations;
const tt = strings.ws.team;

/** Pending company invitations; each can be resent or cancelled (0003 R20). */
export function CompanyInvitationsScreen() {
  const id = useCompanyId();
  const ctx = useCompanyContext(id);
  const list = useCompanyInvites(id);
  const refresh = useRefreshCompany(id);
  const [notice, setNotice] = useState<string | null>(null);
  const act = useAction(async (fn: () => Promise<unknown>, msg: string) => {
    await fn();
    await refresh();
    setNotice(msg);
  }, "invite");
  const canInvite = can(ctx.data?.permissions, CPERM.membersInvite);
  const pending = (list.data ?? []).filter((i) => i.status === "pending");

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t.title }} />
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {act.error ? <Notice tone="danger">{act.error}</Notice> : null}
      <QueryGate queries={[ctx, list]}>
        {!canInvite ? (
          <Notice>{problemMessage({ type: "/problems/forbidden", status: 403 })}</Notice>
        ) : null}
        {canInvite && pending.length === 0 ? <Text tone="textMuted">{t.empty}</Text> : null}
        {canInvite &&
          pending.map((inv) => {
            const expired = isExpired(inv.expires_at);
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
                <Badge label={memberStatusLabel(expired ? "expired" : inv.status)} tone="warning" />
                <Button
                  label={tt.resend}
                  variant="secondary"
                  busy={act.pending}
                  onPress={() => {
                    setNotice(null);
                    void act.run(
                      () => companyApi.invite(id, inv.email, inv.role.id),
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
                      await confirm(tt.cancelInvite, tt.confirmCancel(inv.email), tt.cancelInvite)
                    ) {
                      setNotice(null);
                      void act.run(
                        () => companyApi.cancelInvite(id, inv.id),
                        tt.invitationCancelled(inv.email),
                      );
                    }
                  }}
                />
              </Card>
            );
          })}
      </QueryGate>
    </Screen>
  );
}
